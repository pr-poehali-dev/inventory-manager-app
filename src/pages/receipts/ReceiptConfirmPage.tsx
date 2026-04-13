import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import {
  AppState, crudAction, generateId,
  Receipt, ReceiptLine, ScanEvent,
  updateLocationStock, updateWarehouseStock, Operation,
} from '@/data/store';

type ScanResult = { ok: true; line: ReceiptLine } | { ok: false; reason: string };

function findLineByCode(receipt: Receipt, code: string, state: AppState): ScanResult {
  const barcodes = state.barcodes || [];
  const barcode = barcodes.find(b => b.code === code);
  if (!barcode) {
    return { ok: false, reason: `QR-код «${code.slice(0, 30)}» не найден в базе` };
  }
  const line = receipt.lines.find(l => l.itemId === barcode.itemId);
  if (!line) {
    return { ok: false, reason: `Товар не входит в эту заявку` };
  }
  if (line.confirmedQty >= line.qty) {
    const item = state.items.find(i => i.id === line.itemId);
    return { ok: false, reason: `«${item?.name || line.itemName}» уже принят полностью (${line.qty} ${line.unit})` };
  }
  return { ok: true, line };
}

type NotifType = 'success' | 'error' | null;

export function ReceiptConfirmPage({
  receipt, state, onStateChange, onBack, onPosted,
}: {
  receipt: Receipt;
  state: AppState;
  onStateChange: (s: AppState) => void;
  onBack: () => void;
  onPosted: () => void;
}) {
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [notif, setNotif] = useState<{ type: NotifType; msg: string; itemName?: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [posting, setPosting] = useState(false);

  // per-line inline scanner state
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [editLocationLineId, setEditLocationLineId] = useState<string | null>(null);
  const [lineCameraActive, setLineCameraActive] = useState(false);
  const [lineCameraError, setLineCameraError] = useState('');
  const [lineManualCode, setLineManualCode] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastCodeRef = useRef<string>('');
  const lastCodeTimeRef = useRef<number>(0);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const notifTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // per-line camera refs
  const lineVideoRef = useRef<HTMLVideoElement>(null);
  const lineStreamRef = useRef<MediaStream | null>(null);
  const lineDetectorRef = useRef<BarcodeDetector | null>(null);
  const lineAnimFrameRef = useRef<number>(0);
  const lineLastCodeRef = useRef<string>('');
  const lineLastCodeTimeRef = useRef<number>(0);
  const lineManualInputRef = useRef<HTMLInputElement>(null);

  // Получаем актуальный документ из state
  const liveReceipt = state.receipts.find(r => r.id === receipt.id) || receipt;
  const lines = liveReceipt.lines;

  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const confirmedQty = lines.reduce((s, l) => s + (l.confirmedQty || 0), 0);
  const pct = totalQty > 0 ? Math.round((confirmedQty / totalQty) * 100) : 0;
  const allConfirmed = confirmedQty >= totalQty && totalQty > 0;

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const stopLineCamera = useCallback(() => {
    cancelAnimationFrame(lineAnimFrameRef.current);
    if (lineStreamRef.current) {
      lineStreamRef.current.getTracks().forEach(t => t.stop());
      lineStreamRef.current = null;
    }
    setLineCameraActive(false);
  }, []);

  useEffect(() => () => { stopCamera(); }, [stopCamera]);
  useEffect(() => () => { stopLineCamera(); }, [stopLineCamera]);

  // закрыть inline-панель при смене активной строки
  useEffect(() => {
    stopLineCamera();
    setLineManualCode('');
    setLineCameraError('');
  }, [activeLineId]); // eslint-disable-line react-hooks/exhaustive-deps

  const showNotif = (type: NotifType, msg: string, itemName?: string) => {
    if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
    setNotif({ type, msg, itemName });
    notifTimeoutRef.current = setTimeout(() => setNotif(null), type === 'success' ? 2500 : 4000);
  };

  const processCode = useCallback((code: string, method: 'camera' | 'manual') => {
    const now = Date.now();
    if (code === lastCodeRef.current && now - lastCodeTimeRef.current < 2000) return;
    lastCodeRef.current = code;
    lastCodeTimeRef.current = now;

    const alreadyScanned = (liveReceipt.scanHistory || []).some(e => e.code === code);
    if (alreadyScanned) {
      showNotif('error', `Код «${code.slice(0, 20)}» уже был отсканирован`);
      return;
    }

    const result = findLineByCode(liveReceipt, code, state);

    if (!result.ok) {
      showNotif('error', result.reason);
      return;
    }

    const { line } = result;
    const item = state.items.find(i => i.id === line.itemId);

    const scanEvent: ScanEvent = {
      id: generateId(),
      code,
      itemId: line.itemId,
      lineId: line.id,
      scannedAt: new Date().toISOString(),
      scannedBy: state.currentUser,
      method,
    };

    const updatedLines = liveReceipt.lines.map(l =>
      l.id === line.id ? { ...l, confirmedQty: (l.confirmedQty || 0) + 1 } : l
    );

    const updatedReceipt: Receipt = {
      ...liveReceipt,
      status: 'confirming',
      lines: updatedLines,
      scanHistory: [...(liveReceipt.scanHistory || []), scanEvent],
    };

    const next: AppState = {
      ...state,
      receipts: state.receipts.map(r => r.id === liveReceipt.id ? updatedReceipt : r),
    };

    onStateChange(next);
    crudAction('upsert_receipt', { receipt: updatedReceipt, receiptLines: updatedReceipt.lines });

    const newConfirmed = updatedLines.reduce((s, l) => s + (l.confirmedQty || 0), 0);
    const lineConfirmed = updatedLines.find(l => l.id === line.id)?.confirmedQty || 0;
    showNotif('success', `+1 принято (${lineConfirmed}/${line.qty} ${line.unit})`, item?.name || line.itemName);

    if (newConfirmed >= totalQty) {
      setTimeout(() => setNotif(null), 100);
    }
  }, [liveReceipt, state, onStateChange, totalQty]);

  // processCode для inline-сканера конкретной строки
  const processLineCode = useCallback((code: string, method: 'camera' | 'manual', lineId: string) => {
    const now = Date.now();
    if (code === lineLastCodeRef.current && now - lineLastCodeTimeRef.current < 2000) return;
    lineLastCodeRef.current = code;
    lineLastCodeTimeRef.current = now;

    const alreadyScanned = (liveReceipt.scanHistory || []).some(e => e.code === code);
    if (alreadyScanned) {
      showNotif('error', `Код «${code.slice(0, 20)}» уже был отсканирован`);
      return;
    }

    const targetLine = liveReceipt.lines.find(l => l.id === lineId);
    if (!targetLine) return;

    if (targetLine.confirmedQty >= targetLine.qty) {
      showNotif('error', `«${targetLine.itemName}» уже принят полностью (${targetLine.qty} ${targetLine.unit})`);
      return;
    }

    const item = state.items.find(i => i.id === targetLine.itemId);

    const scanEvent: ScanEvent = {
      id: generateId(),
      code,
      itemId: targetLine.itemId,
      lineId: targetLine.id,
      scannedAt: new Date().toISOString(),
      scannedBy: state.currentUser,
      method,
    };

    const updatedLines = liveReceipt.lines.map(l =>
      l.id === lineId ? { ...l, confirmedQty: (l.confirmedQty || 0) + 1 } : l
    );

    const updatedReceipt: Receipt = {
      ...liveReceipt,
      status: 'confirming',
      lines: updatedLines,
      scanHistory: [...(liveReceipt.scanHistory || []), scanEvent],
    };

    const next: AppState = {
      ...state,
      receipts: state.receipts.map(r => r.id === liveReceipt.id ? updatedReceipt : r),
    };

    onStateChange(next);
    crudAction('upsert_receipt', { receipt: updatedReceipt, receiptLines: updatedReceipt.lines });

    const lineConfirmed = updatedLines.find(l => l.id === lineId)?.confirmedQty || 0;
    showNotif('success', `+1 принято (${lineConfirmed}/${targetLine.qty} ${targetLine.unit})`, item?.name || targetLine.itemName);

    const newConfirmed = updatedLines.reduce((s, l) => s + (l.confirmedQty || 0), 0);
    if (newConfirmed >= totalQty) {
      setTimeout(() => setNotif(null), 100);
    }
  }, [liveReceipt, state, onStateChange, totalQty]);

  const startCamera = async () => {
    setCameraError('');
    if (typeof BarcodeDetector === 'undefined') {
      setCameraError('Браузер не поддерживает сканер. Введите код вручную.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const formats = ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'data_matrix', 'upc_a', 'upc_e', 'itf'];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      detectorRef.current = new (BarcodeDetector as any)({ formats });
      setCameraActive(true);

      const scan = async () => {
        if (!videoRef.current || !detectorRef.current) return;
        if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          try {
            const barcodes = await detectorRef.current.detect(videoRef.current);
            for (const b of barcodes) {
              if (b.rawValue) processCode(b.rawValue, 'camera');
            }
          } catch { /* ignore */ }
        }
        animFrameRef.current = requestAnimationFrame(scan);
      };
      animFrameRef.current = requestAnimationFrame(scan);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCameraError(msg.includes('Permission') ? 'Нет доступа к камере. Разрешите в настройках браузера.' : 'Не удалось открыть камеру: ' + msg);
    }
  };

  const startLineCamera = async (lineId: string) => {
    setLineCameraError('');
    if (typeof BarcodeDetector === 'undefined') {
      setLineCameraError('Браузер не поддерживает сканер. Введите код вручную.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      lineStreamRef.current = stream;
      if (lineVideoRef.current) {
        lineVideoRef.current.srcObject = stream;
        await lineVideoRef.current.play();
      }
      const formats = ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'data_matrix', 'upc_a', 'upc_e', 'itf'];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lineDetectorRef.current = new (BarcodeDetector as any)({ formats });
      setLineCameraActive(true);

      const scan = async () => {
        if (!lineVideoRef.current || !lineDetectorRef.current) return;
        if (lineVideoRef.current.readyState === lineVideoRef.current.HAVE_ENOUGH_DATA) {
          try {
            const barcodes = await lineDetectorRef.current.detect(lineVideoRef.current);
            for (const b of barcodes) {
              if (b.rawValue) processLineCode(b.rawValue, 'camera', lineId);
            }
          } catch { /* ignore */ }
        }
        lineAnimFrameRef.current = requestAnimationFrame(scan);
      };
      lineAnimFrameRef.current = requestAnimationFrame(scan);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLineCameraError(msg.includes('Permission') ? 'Нет доступа к камере. Разрешите в настройках браузера.' : 'Не удалось открыть камеру: ' + msg);
    }
  };

  const handleManualAdd = () => {
    const code = manualCode.trim();
    if (!code) return;
    processCode(code, 'manual');
    setManualCode('');
    manualInputRef.current?.focus();
  };

  const handleLineManualAdd = (lineId: string) => {
    const code = lineManualCode.trim();
    if (!code) return;
    processLineCode(code, 'manual', lineId);
    setLineManualCode('');
    lineManualInputRef.current?.focus();
  };

  const handleManualQty = (lineId: string, delta: number) => {
    const updatedLines = liveReceipt.lines.map(l => {
      if (l.id !== lineId) return l;
      const newQty = Math.max(0, Math.min(l.qty, (l.confirmedQty || 0) + delta));
      return { ...l, confirmedQty: newQty };
    });

    const updatedReceipt: Receipt = {
      ...liveReceipt,
      status: 'confirming',
      lines: updatedLines,
    };

    const next: AppState = {
      ...state,
      receipts: state.receipts.map(r => r.id === liveReceipt.id ? updatedReceipt : r),
    };
    onStateChange(next);
    crudAction('upsert_receipt', { receipt: updatedReceipt, receiptLines: updatedReceipt.lines });
  };

  const handleSetQty = (lineId: string, value: number) => {
    const updatedLines = liveReceipt.lines.map(l => {
      if (l.id !== lineId) return l;
      const clamped = Math.max(0, Math.min(l.qty, value));
      return { ...l, confirmedQty: clamped };
    });
    const updatedReceipt: Receipt = { ...liveReceipt, status: 'confirming', lines: updatedLines };
    const next: AppState = { ...state, receipts: state.receipts.map(r => r.id === liveReceipt.id ? updatedReceipt : r) };
    onStateChange(next);
    crudAction('upsert_receipt', { receipt: updatedReceipt, receiptLines: updatedReceipt.lines });
  };

  const handleChangeLocation = (lineId: string, newLocationId: string) => {
    const updatedLines = liveReceipt.lines.map(l =>
      l.id === lineId ? { ...l, locationId: newLocationId } : l
    );
    const updatedReceipt: Receipt = { ...liveReceipt, lines: updatedLines };
    const next: AppState = { ...state, receipts: state.receipts.map(r => r.id === liveReceipt.id ? updatedReceipt : r) };
    onStateChange(next);
    crudAction('upsert_receipt', { receipt: updatedReceipt, receiptLines: updatedReceipt.lines });
    setEditLocationLineId(null);
  };

  const handleDeleteLine = (lineId: string) => {
    const updatedLines = liveReceipt.lines.filter(l => l.id !== lineId);
    if (updatedLines.length === 0) return;
    const updatedReceipt: Receipt = { ...liveReceipt, lines: updatedLines };
    const next: AppState = { ...state, receipts: state.receipts.map(r => r.id === liveReceipt.id ? updatedReceipt : r) };
    onStateChange(next);
    crudAction('upsert_receipt', { receipt: updatedReceipt, receiptLines: updatedReceipt.lines });
  };

  const handlePost = () => {
    if (!allConfirmed) return;
    setPosting(true);

    let next = { ...state };

    const newOperations: Operation[] = [];

    for (const line of liveReceipt.lines) {
      const qty = line.confirmedQty || 0;
      if (qty <= 0) continue;

      if (liveReceipt.warehouseId) {
        next = updateWarehouseStock(next, line.itemId, liveReceipt.warehouseId, qty);
      } else {
        next = {
          ...next,
          items: next.items.map(i => i.id === line.itemId ? { ...i, quantity: i.quantity + qty } : i),
        };
      }

      if (line.locationId) {
        next = updateLocationStock(next, line.itemId, line.locationId, qty);
      }

      const op: Operation = {
        id: generateId(),
        itemId: line.itemId,
        type: 'in',
        quantity: qty,
        comment: `[Оприходование ${liveReceipt.number}]`,
        from: liveReceipt.supplierName,
        to: line.locationId ? next.locations.find(l => l.id === line.locationId)?.name : undefined,
        performedBy: next.currentUser,
        date: new Date().toISOString(),
        locationId: line.locationId || undefined,
        warehouseId: liveReceipt.warehouseId || undefined,
        scannedCodes: (liveReceipt.scanHistory || [])
          .filter(s => s.lineId === line.id)
          .map(s => s.code),
      };
      newOperations.push(op);
    }

    const postedReceipt: Receipt = {
      ...liveReceipt,
      status: 'posted',
      postedAt: new Date().toISOString(),
    };

    next = {
      ...next,
      receipts: next.receipts.map(r => r.id === liveReceipt.id ? postedReceipt : r),
      operations: [...newOperations, ...next.operations],
    };

    onStateChange(next);
    crudAction('upsert_receipt', { receipt: postedReceipt, receiptLines: postedReceipt.lines });
    for (const op of newOperations) {
      const updatedItem = next.items.find(i => i.id === op.itemId);
      const wsArr = (next.warehouseStocks || []).filter(w => w.itemId === op.itemId);
      const lsArr = (next.locationStocks || []).filter(ls => ls.itemId === op.itemId);
      crudAction('upsert_operation', { operation: op, item: updatedItem, warehouseStocks: wsArr, locationStocks: lsArr });
    }
    setPosting(false);
    onPosted();
  };

  const isSuccess = notif?.type === 'success';
  const isError = notif?.type === 'error';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <Icon name="ArrowLeft" size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base truncate">{liveReceipt.number}</div>
          <div className="text-xs text-muted-foreground">{liveReceipt.supplierName} · Этап 2: Подтверждение</div>
        </div>
        <button
          onClick={() => setShowHistory(h => !h)}
          className="p-2 rounded-lg hover:bg-muted transition-colors relative"
        >
          <Icon name="History" size={20} />
          {(liveReceipt.scanHistory || []).length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-[10px] text-white rounded-full flex items-center justify-center font-bold">
              {Math.min((liveReceipt.scanHistory || []).length, 99)}
            </span>
          )}
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">Просканировано</span>
          <span className={`text-sm font-bold ${allConfirmed ? 'text-success' : 'text-foreground'}`}>
            {confirmedQty} / {totalQty} ед. ({pct}%)
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allConfirmed ? 'bg-success' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {allConfirmed && (
          <div className="flex items-center gap-1.5 mt-2 text-success text-sm font-semibold">
            <Icon name="CheckCircle2" size={16} />
            Все позиции подтверждены!
          </div>
        )}
      </div>

      {/* Notification overlay */}
      {notif && (
        <div className={`mx-4 rounded-2xl p-4 flex items-center gap-3 transition-all ${
          isSuccess ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'
        }`}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/20">
            <Icon name={isSuccess ? 'CheckCircle2' : 'XCircle'} size={22} />
          </div>
          <div className="flex-1 min-w-0">
            {isSuccess && notif.itemName && (
              <div className="font-bold text-base truncate">{notif.itemName}</div>
            )}
            <div className={`${isSuccess ? 'text-white/90' : ''} text-sm`}>{notif.msg}</div>
          </div>
        </div>
      )}

      {/* Global Camera / Scanner block */}
      <div className="px-4 pt-3 space-y-3">
        <div className={`relative rounded-2xl overflow-hidden bg-black transition-all ${
          isSuccess ? 'ring-4 ring-success' : isError ? 'ring-4 ring-destructive' : ''
        }`} style={{ aspectRatio: cameraActive ? '16/9' : 'auto', minHeight: cameraActive ? undefined : '120px' }}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline muted
            style={{ display: cameraActive ? 'block' : 'none' }}
          />

          {!cameraActive && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
                <Icon name="Camera" size={28} className="text-white/60" />
              </div>
              {cameraError ? (
                <p className="text-sm text-red-400 text-center px-6">{cameraError}</p>
              ) : (
                <p className="text-sm text-white/60 text-center">Нажмите кнопку для включения камеры</p>
              )}
              <Button onClick={startCamera} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 text-base px-6 py-3 h-auto">
                <Icon name="Camera" size={18} />
                Включить камеру
              </Button>
            </div>
          )}

          {cameraActive && (
            <>
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-[15%] border-2 border-white/50 rounded-xl" />
                <div className="absolute top-[15%] left-[15%] w-8 h-8 border-t-3 border-l-3 border-primary rounded-tl-xl" style={{ borderWidth: 3 }} />
                <div className="absolute top-[15%] right-[15%] w-8 h-8 border-t-3 border-r-3 border-primary rounded-tr-xl" style={{ borderWidth: 3 }} />
                <div className="absolute bottom-[15%] left-[15%] w-8 h-8 border-b-3 border-l-3 border-primary rounded-bl-xl" style={{ borderWidth: 3 }} />
                <div className="absolute bottom-[15%] right-[15%] w-8 h-8 border-b-3 border-r-3 border-primary rounded-br-xl" style={{ borderWidth: 3 }} />
              </div>
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                <button
                  onClick={stopCamera}
                  className="px-4 py-2 bg-black/60 text-white text-sm rounded-xl flex items-center gap-2 hover:bg-black/80"
                >
                  <Icon name="CameraOff" size={14} />Выключить
                </button>
              </div>
              {isSuccess && (
                <div className="absolute inset-0 bg-success/20 pointer-events-none animate-pulse" />
              )}
              {isError && (
                <div className="absolute inset-0 bg-destructive/20 pointer-events-none" />
              )}
            </>
          )}
        </div>

        {/* Global manual input */}
        <div className="flex gap-2">
          <Input
            ref={manualInputRef}
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleManualAdd(); }}
            placeholder="Ввести код вручную..."
            className="h-12 text-base"
          />
          <Button onClick={handleManualAdd} disabled={!manualCode.trim()} variant="outline" className="h-12 px-4 shrink-0">
            <Icon name="Plus" size={18} />
          </Button>
        </div>
      </div>

      {/* Lines list */}
      <div className="px-4 pt-4 pb-4 space-y-2 flex-1">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Позиции заявки
        </div>

        {/* History panel */}
        {showHistory && (liveReceipt.scanHistory || []).length > 0 && (
          <div className="rounded-xl border border-border bg-muted/40 p-3 mb-3 max-h-48 overflow-y-auto space-y-1">
            <div className="text-xs font-semibold text-muted-foreground mb-2">История сканирований</div>
            {[...(liveReceipt.scanHistory || [])].reverse().map(ev => {
              const item = state.items.find(i => i.id === ev.itemId);
              return (
                <div key={ev.id} className="flex items-center gap-2 text-xs">
                  <Icon name={ev.method === 'camera' ? 'Camera' : 'Keyboard'} size={11} className="text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{new Date(ev.scannedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <span className="font-medium truncate">{item?.name || ev.itemId}</span>
                  <span className="text-muted-foreground shrink-0 font-mono">{ev.code.slice(0, 12)}</span>
                </div>
              );
            })}
          </div>
        )}

        {lines.map(line => {
          const item = state.items.find(i => i.id === line.itemId);
          const loc = state.locations.find(l => l.id === line.locationId);
          const confirmed = line.confirmedQty || 0;
          const done = confirmed >= line.qty;
          const partial = confirmed > 0 && !done;
          const isActive = activeLineId === line.id;

          return (
            <div
              key={line.id}
              className={`rounded-xl border transition-all ${
                done ? 'border-success/40 bg-success/8' :
                partial ? 'border-amber-500/40 bg-amber-500/8' :
                'border-border bg-card'
              }`}
            >
              <div className="p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    done ? 'bg-success/20 text-success' :
                    partial ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    <Icon name={done ? 'CheckCircle2' : partial ? 'Clock' : 'Package'} size={16} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{item?.name || line.itemName}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditLocationLineId(editLocationLineId === line.id ? null : line.id); }}
                        className="flex items-center gap-0.5 hover:text-primary transition-colors"
                        title="Изменить стеллаж"
                      >
                        <Icon name="MapPin" size={9} />
                        {loc ? loc.name : 'Не указан'}
                        <Icon name="Pencil" size={8} className="opacity-50" />
                      </button>
                      {line.isNew && <span className="text-primary font-medium">Новый</span>}
                    </div>
                    {editLocationLineId === line.id && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(liveReceipt.warehouseId
                          ? state.locations.filter(l => l.warehouseId === liveReceipt.warehouseId)
                          : state.locations
                        ).map(l => (
                          <button
                            key={l.id}
                            onClick={() => handleChangeLocation(line.id, l.id)}
                            className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                              l.id === line.locationId
                                ? 'border-primary bg-primary/10 text-primary font-semibold'
                                : 'border-border hover:border-primary/40 hover:bg-muted'
                            }`}
                          >
                            {l.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center gap-0.5">
                      <input
                        type="number"
                        min={0}
                        max={line.qty}
                        value={confirmed}
                        onChange={e => handleSetQty(line.id, parseInt(e.target.value) || 0)}
                        className={`w-12 h-8 text-center text-sm font-bold tabular-nums rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring
                          ${done ? 'text-success' : partial ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}
                      />
                      <span className="text-muted-foreground text-sm">/{line.qty}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{line.unit}</div>
                    {liveReceipt.lines.length > 1 && (
                      <button onClick={() => handleDeleteLine(line.id)} title="Удалить строку"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Icon name="Trash2" size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Mini progress bar */}
                {!done && line.qty > 1 && (
                  <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${Math.round((confirmed / line.qty) * 100)}%` }}
                    />
                  </div>
                )}

                {/* Toggle scan panel button */}
                {!done && (
                  <button
                    onClick={() => setActiveLineId(isActive ? null : line.id)}
                    className={`mt-2 w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      isActive
                        ? 'border-primary/40 bg-primary/8 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon name={isActive ? 'ChevronUp' : 'ScanLine'} size={13} />
                    {isActive ? 'Скрыть сканер' : 'Сканировать / ввести код'}
                  </button>
                )}
              </div>

              {/* Inline scan panel */}
              {isActive && !done && (
                <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
                  {/* Inline camera */}
                  <div className={`relative rounded-xl overflow-hidden bg-black ${
                    lineCameraActive ? '' : 'min-h-[80px]'
                  }`} style={{ aspectRatio: lineCameraActive ? '16/9' : 'auto' }}>
                    <video
                      ref={lineVideoRef}
                      className="w-full h-full object-cover"
                      playsInline muted
                      style={{ display: lineCameraActive ? 'block' : 'none' }}
                    />
                    {!lineCameraActive && (
                      <div className="flex flex-col items-center justify-center py-4 gap-2">
                        {lineCameraError ? (
                          <p className="text-xs text-red-400 text-center px-4">{lineCameraError}</p>
                        ) : null}
                        <Button
                          onClick={() => startLineCamera(line.id)}
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                        >
                          <Icon name="Camera" size={14} />
                          Включить камеру
                        </Button>
                      </div>
                    )}
                    {lineCameraActive && (
                      <>
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute inset-[15%] border-2 border-white/50 rounded-xl" />
                          <div className="absolute top-[15%] left-[15%] w-6 h-6 border-primary rounded-tl-xl" style={{ borderTopWidth: 3, borderLeftWidth: 3 }} />
                          <div className="absolute top-[15%] right-[15%] w-6 h-6 border-primary rounded-tr-xl" style={{ borderTopWidth: 3, borderRightWidth: 3 }} />
                          <div className="absolute bottom-[15%] left-[15%] w-6 h-6 border-primary rounded-bl-xl" style={{ borderBottomWidth: 3, borderLeftWidth: 3 }} />
                          <div className="absolute bottom-[15%] right-[15%] w-6 h-6 border-primary rounded-br-xl" style={{ borderBottomWidth: 3, borderRightWidth: 3 }} />
                        </div>
                        <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                          <button
                            onClick={stopLineCamera}
                            className="px-3 py-1.5 bg-black/60 text-white text-xs rounded-xl flex items-center gap-1.5 hover:bg-black/80"
                          >
                            <Icon name="CameraOff" size={12} />Выключить
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Inline manual input */}
                  <div className="flex gap-2">
                    <Input
                      ref={lineManualInputRef}
                      value={lineManualCode}
                      onChange={e => setLineManualCode(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleLineManualAdd(line.id); }}
                      placeholder="Ввести код товара..."
                      className="h-10 text-sm"
                    />
                    <Button
                      onClick={() => handleLineManualAdd(line.id)}
                      disabled={!lineManualCode.trim()}
                      variant="outline"
                      className="h-10 px-3 shrink-0"
                    >
                      <Icon name="Plus" size={16} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3 space-y-2">
        {!allConfirmed && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon name="Info" size={14} />
            <span>Осталось принять: <b className="text-foreground">{totalQty - confirmedQty} ед.</b> из {totalQty}</span>
          </div>
        )}

        {allConfirmed ? (
          <Button
            onClick={handlePost}
            disabled={posting}
            className="w-full h-14 text-lg font-bold bg-success hover:bg-success/90 text-success-foreground gap-3 rounded-xl"
          >
            <Icon name="CheckCircle2" size={22} />
            Подтвердить оприходование
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack} className="flex-1 h-12">
              <Icon name="ArrowLeft" size={16} className="mr-1.5" />Назад
            </Button>
            <Button
              onClick={handlePost}
              disabled={confirmedQty === 0}
              variant="outline"
              className="flex-1 h-12 border-amber-500/50 text-amber-600 dark:text-amber-400"
            >
              <Icon name="Save" size={16} className="mr-1.5" />Сохранить черновик
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}