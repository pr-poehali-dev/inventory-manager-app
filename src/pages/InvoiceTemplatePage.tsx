import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { AppState } from '@/data/store';

const STORAGE_KEY = 'invoice_template_html';

type FieldDef = { key: string; label: string; group: string };

const FIELDS: FieldDef[] = [
  { key: 'number', label: 'Номер накладной', group: 'Заявка' },
  { key: 'date', label: 'Дата (полная)', group: 'Заявка' },
  { key: 'dateShort', label: 'Дата (коротко)', group: 'Заявка' },
  { key: 'recipient', label: 'Получатель', group: 'Заявка' },
  { key: 'senderDept', label: 'Отправитель (подразделение)', group: 'Заявка' },
  { key: 'receiverDept', label: 'Получатель (подразделение)', group: 'Заявка' },
  { key: 'institution', label: 'Учреждение', group: 'Склад (профиль)' },
  { key: 'senderDeptProfile', label: 'Подразделение-отправитель', group: 'Склад (профиль)' },
  { key: 'issuerRank', label: 'Отпустил: звание', group: 'Склад (профиль)' },
  { key: 'issuerName', label: 'Отпустил: ФИО', group: 'Склад (профиль)' },
  { key: 'approverRole', label: 'Разрешил: должность', group: 'Склад (профиль)' },
  { key: 'approverName', label: 'Разрешил: ФИО', group: 'Склад (профиль)' },
  { key: 'requesterRank', label: 'Затребовал: звание', group: 'Склад (профиль)' },
  { key: 'requesterName', label: 'Затребовал: ФИО', group: 'Склад (профиль)' },
  { key: 'receiverRank', label: 'Получил: звание', group: 'Склад (профиль)' },
  { key: 'receiverName', label: 'Получил: ФИО', group: 'Склад (профиль)' },
  { key: 'signatory', label: 'ФИО подписанта (общий шаблон)', group: 'Организация' },
  { key: 'signatoryRole', label: 'Должность подписанта (общий шаблон)', group: 'Организация' },
  { key: 'okud', label: 'Код ОКУД', group: 'Коды' },
  { key: 'okpo', label: 'Код ОКПО', group: 'Коды' },
  { key: 'okei', label: 'Код ОКЕИ', group: 'Коды' },
  { key: 'totalReq', label: 'Итого затребовано', group: 'Итоги' },
  { key: 'totalRel', label: 'Итого отпущено', group: 'Итоги' },
  { key: 'totalSum', label: 'Итого сумма', group: 'Итоги' },
  { key: 'itemsRows', label: 'Шаблонная строка (клонируется по товарам)', group: 'Таблица товаров' },
  { key: 'rowIndex', label: 'Ячейка: № по порядку', group: 'Ячейки строки' },
  { key: 'rowName', label: 'Ячейка: Наименование', group: 'Ячейки строки' },
  { key: 'rowUnit', label: 'Ячейка: Ед. изм.', group: 'Ячейки строки' },
  { key: 'rowQtyReq', label: 'Ячейка: Затребовано', group: 'Ячейки строки' },
  { key: 'rowQtyRel', label: 'Ячейка: Отпущено', group: 'Ячейки строки' },
  { key: 'rowPrice', label: 'Ячейка: Цена', group: 'Ячейки строки' },
  { key: 'rowSum', label: 'Ячейка: Сумма', group: 'Ячейки строки' },
];

const PLACEHOLDER_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: 'Times New Roman', serif; padding: 40px; color: #333; }
  .hint { max-width: 640px; margin: 80px auto; text-align: center; }
  h1 { font-size: 22px; margin-bottom: 16px; }
  p { font-size: 14px; line-height: 1.6; color: #555; }
  .box { border: 2px dashed #bbb; border-radius: 12px; padding: 40px; background: #fafafa; }
</style>
</head>
<body>
<div class="hint">
  <div class="box">
    <h1>Шаблон накладной не загружен</h1>
    <p>Нажмите кнопку <b>«Загрузить HTML»</b> в верхней панели и выберите HTML-файл накладной — он откроется здесь один в один, как в браузере.</p>
  </div>
</div>
</body>
</html>`;

interface Props {
  state: AppState;
  onStateChange: (s: AppState) => void;
}

export default function InvoiceTemplatePage({ state, onStateChange }: Props) {
  void state;
  void onStateChange;

  const [html, setHtml] = useState<string>(PLACEHOLDER_HTML);
  const [zoom, setZoom] = useState(1);
  const [saveFlash, setSaveFlash] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [iframeHeight, setIframeHeight] = useState(1100);
  const [mapMode, setMapMode] = useState(false);
  const [picker, setPicker] = useState<{ x: number; y: number; targetId: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapModeRef = useRef(mapMode);
  mapModeRef.current = mapMode;

  const ensureBindIds = (doc: Document) => {
    doc.querySelectorAll('[data-bind]').forEach((el, i) => {
      if (!(el as HTMLElement).dataset.bindId) {
        (el as HTMLElement).dataset.bindId = `b_${i}_${Date.now().toString(36)}`;
      }
    });
  };

  const highlightExistingBinds = (doc: Document) => {
    let styleEl = doc.getElementById('__bind_style') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = '__bind_style';
      doc.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      [data-bind] {
        background: transparent !important;
        outline: none !important;
      }
      .__map-mode [data-bind] {
        background: rgba(34, 197, 94, 0.18) !important;
        outline: 1px dashed #16a34a !important;
        cursor: pointer !important;
      }
      .__map-mode [data-bindable-hover]:hover {
        background: rgba(59, 130, 246, 0.18) !important;
        outline: 1px dashed #2563eb !important;
        cursor: pointer !important;
      }
      @media print {
        [data-bind], .__map-mode [data-bind] {
          background: transparent !important;
          outline: none !important;
        }
      }
    `;
  };

  const handleIframeLoad = useCallback(() => {
    const f = iframeRef.current;
    if (!f) return;
    try {
      const doc = f.contentDocument;
      if (!doc) return;
      const measure = () => {
        const all = Array.from(doc.querySelectorAll('body *'));
        let maxBottom = 0;
        for (const el of all) {
          const r = (el as HTMLElement).getBoundingClientRect();
          if (r.bottom > maxBottom) maxBottom = r.bottom;
        }
        const h = Math.max(
          maxBottom,
          doc.body?.scrollHeight || 0,
          doc.documentElement?.scrollHeight || 0,
          900,
        );
        setIframeHeight(Math.ceil(h) + 40);
      };
      measure();
      setTimeout(measure, 150);
      setTimeout(measure, 600);
      setTimeout(measure, 1500);

      ensureBindIds(doc);
      highlightExistingBinds(doc);

      const onClick = (e: MouseEvent) => {
        if (!mapModeRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        const target = e.target as HTMLElement;
        if (!target || target === doc.body) return;
        let el: HTMLElement = target;
        const cell = el.closest('td,th') as HTMLElement | null;
        if (cell) el = cell;
        if (!el.dataset.bindId) el.dataset.bindId = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const frameRect = f.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        setPicker({
          x: frameRect.left + r.left + r.width / 2,
          y: frameRect.top + r.bottom + 4,
          targetId: el.dataset.bindId!,
        });
      };

      const onOver = (e: MouseEvent) => {
        if (!mapModeRef.current) return;
        const t = e.target as HTMLElement;
        if (t && t !== doc.body) t.setAttribute('data-bindable-hover', '1');
      };
      const onOut = (e: MouseEvent) => {
        const t = e.target as HTMLElement;
        if (t) t.removeAttribute('data-bindable-hover');
      };

      doc.addEventListener('click', onClick, true);
      doc.addEventListener('mouseover', onOver, true);
      doc.addEventListener('mouseout', onOut, true);
    } catch { /* cross-origin guard */ }
  }, []);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    if (mapMode) doc.body?.classList.add('__map-mode');
    else doc.body?.classList.remove('__map-mode');
  }, [mapMode, html]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHtml(saved);
      const savedName = localStorage.getItem(STORAGE_KEY + '_name');
      if (savedName) setFileName(savedName);
    } catch { /* ignore */ }
  }, []);

  const handleSave = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, html);
      if (fileName) localStorage.setItem(STORAGE_KEY + '_name', fileName);
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 1500);
    } catch (e) {
      alert('Не удалось сохранить: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [html, fileName]);

  const handleClear = useCallback(() => {
    if (!confirm('Удалить загруженный шаблон?')) return;
    setHtml(PLACEHOLDER_HTML);
    setFileName('');
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY + '_name');
  }, []);

  const handleLoadHtml = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const content = String(evt.target?.result || '');
      if (!content.trim()) {
        alert('Файл пустой.');
        return;
      }
      setHtml(content);
      setFileName(file.name);
      try {
        localStorage.setItem(STORAGE_KEY, content);
        localStorage.setItem(STORAGE_KEY + '_name', file.name);
        setSaveFlash(true);
        setTimeout(() => setSaveFlash(false), 1500);
      } catch (err) {
        alert('Файл слишком большой для сохранения: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.onerror = () => alert('Ошибка чтения файла');
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  }, []);

  const handlePrint = useCallback(() => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }, [html]);

  const applyBind = useCallback((field: string) => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || !picker) return;
    let el = doc.querySelector(`[data-bind-id="${picker.targetId}"]`) as HTMLElement | null;
    if (el) {
      if (field === 'itemsRows' && el.tagName !== 'TR') {
        const tr = el.closest('tr') as HTMLElement | null;
        if (tr) {
          if (!tr.dataset.bindId) tr.dataset.bindId = `b_${Date.now().toString(36)}_r`;
          el = tr;
        }
      }
      if (field === '__clear__') {
        el.removeAttribute('data-bind');
      } else {
        el.setAttribute('data-bind', field);
      }
      // Clone the document and strip editor-only styles before saving
      const clone = doc.documentElement.cloneNode(true) as HTMLElement;
      const bindStyle = clone.querySelector('#__bind_style');
      if (bindStyle) bindStyle.remove();
      setHtml(`<!DOCTYPE html>\n${clone.outerHTML}`);
      // Re-apply highlight only for the live editor iframe
      highlightExistingBinds(doc);
    }
    setPicker(null);
  }, [picker]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'invoice-template.html';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [html, fileName]);

  return (
    <div className="h-full flex flex-col bg-gray-200">
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-300 shrink-0" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <Button variant="ghost" size="sm" onClick={handleLoadHtml} title="Загрузить HTML" className="gap-1.5">
          <Icon name="Upload" size={16} />
          <span className="text-xs">Загрузить HTML</span>
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".html,.htm,text/html"
          onChange={handleFileSelected}
          className="hidden"
        />

        <div className="mx-1 h-5 w-px bg-gray-200" />

        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          title="Сохранить"
          className={`gap-1.5 ${saveFlash ? 'text-green-600' : ''}`}
        >
          <Icon name={saveFlash ? 'Check' : 'Save'} size={16} />
          <span className="text-xs">{saveFlash ? 'Сохранено' : 'Сохранить'}</span>
        </Button>

        <Button variant="ghost" size="sm" onClick={handleDownload} title="Скачать HTML" className="gap-1.5">
          <Icon name="Download" size={16} />
          <span className="text-xs">Скачать</span>
        </Button>

        <Button variant="ghost" size="sm" onClick={handlePrint} title="Печать" className="gap-1.5">
          <Icon name="Printer" size={16} />
          <span className="text-xs">Печать</span>
        </Button>

        <div className="mx-1 h-5 w-px bg-gray-200" />

        <Button
          variant={mapMode ? 'default' : 'ghost'}
          size="sm"
          onClick={() => { setMapMode(m => !m); setPicker(null); }}
          title="Режим разметки полей"
          className="gap-1.5"
        >
          <Icon name={mapMode ? 'MousePointerClick' : 'Target'} size={16} />
          <span className="text-xs">{mapMode ? 'Готово' : 'Разметить'}</span>
        </Button>

        <Button variant="ghost" size="sm" onClick={handleClear} title="Очистить" className="gap-1.5 text-red-600">
          <Icon name="Trash2" size={16} />
          <span className="text-xs">Очистить</span>
        </Button>

        <div className="flex-1" />

        {fileName && (
          <div className="text-xs text-gray-500 truncate max-w-[300px]" title={fileName}>
            <Icon name="FileText" size={12} className="inline mr-1" />
            {fileName}
          </div>
        )}

        <div className="mx-1 h-5 w-px bg-gray-200" />

        <div className="flex items-center gap-1">
          <button
            className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            onClick={() => setZoom(z => Math.max(0.3, +(z - 0.1).toFixed(1)))}
            title="Уменьшить"
          >
            −
          </button>
          <span className="w-12 text-center text-xs text-gray-600 tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))}
            title="Увеличить"
          >
            +
          </button>
          <button
            className="ml-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            onClick={() => setZoom(1)}
            title="Сбросить масштаб"
          >
            100%
          </button>
        </div>
      </div>

      {mapMode && (
        <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-200 text-xs text-blue-900 flex items-center gap-2">
          <Icon name="Info" size={12} />
          Режим разметки: кликните по элементу в шаблоне и выберите поле для привязки. Зелёным помечены уже привязанные элементы.
        </div>
      )}

      <div className="flex-1 overflow-auto bg-gray-100 relative">
        <iframe
          ref={iframeRef}
          srcDoc={html}
          onLoad={handleIframeLoad}
          title="Шаблон накладной"
          className="border-0 block bg-white"
          style={{
            width: '100%',
            height: Math.max(iframeHeight, 900),
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transformOrigin: 'top left',
          }}
          sandbox="allow-same-origin allow-scripts"
        />
      </div>

      {picker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPicker(null)} />
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-2 max-h-[400px] overflow-auto"
            style={{
              left: Math.max(8, Math.min(picker.x - 140, window.innerWidth - 290)),
              top: Math.min(picker.y, window.innerHeight - 420),
              width: 280,
            }}
          >
            <div className="text-xs font-semibold text-gray-500 px-2 py-1 uppercase tracking-wide">
              Привязать к полю:
            </div>
            {Object.entries(
              FIELDS.reduce<Record<string, FieldDef[]>>((acc, f) => {
                (acc[f.group] ||= []).push(f);
                return acc;
              }, {})
            ).map(([group, fields]) => (
              <div key={group} className="mb-1">
                <div className="text-[10px] font-semibold text-gray-400 px-2 pt-1 pb-0.5">{group}</div>
                {fields.map(f => (
                  <button
                    key={f.key}
                    onClick={() => applyBind(f.key)}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 rounded flex items-center gap-2"
                  >
                    <span className="flex-1">{f.label}</span>
                    <code className="text-[10px] text-gray-400">{`{{${f.key}}}`}</code>
                  </button>
                ))}
              </div>
            ))}
            <div className="border-t border-gray-200 mt-1 pt-1">
              <button
                onClick={() => applyBind('__clear__')}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-red-50 rounded text-red-600 flex items-center gap-2"
              >
                <Icon name="X" size={12} />Убрать привязку
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}