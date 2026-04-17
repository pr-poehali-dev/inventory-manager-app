import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { AppState } from '@/data/store';

const STORAGE_KEY = 'invoice_template_html';

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    } catch { /* cross-origin guard */ }
  }, []);

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

      <div className="flex-1 overflow-auto bg-gray-100">
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
    </div>
  );
}