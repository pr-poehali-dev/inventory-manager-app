import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import {
  AppState, saveState, generateId,
  Receipt, ReceiptLine, ScanEvent,
  updateLocationStock, Operation,
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastCodeRef = useRef<string>('');
  const lastCodeTimeRef = useRef<number>(0);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const notifTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => () => { stopCamera(); }, [stopCamera]);

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
    saveState(next);

    const newConfirmed = updatedLines.reduce((s, l) => s + (l.confirmedQty || 0), 0);
    const lineConfirmed = updatedLines.find(l => l.id === line.id)?.confirmedQty || 0;
    showNotif('success', `+1 принято (${lineConfirmed}/${line.qty} ${line.unit})`, item?.name || line.itemName);

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

  const handleManualAdd = () => {
    const code = manualCode.trim();
    if (!code) return;
    processCode(code, 'manual');
    setManualCode('');
    manualInputRef.current?.focus();
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
    saveState(next);
  };

  const handlePost = () => {
    if (!allConfirmed) return;
    setPosting(true);

    let next = { ...state };

    const newOperations: Operation[] = [];

    for (const line of liveReceipt.lines) {
      const qty = line.confirmedQty || 0;
      if (qty <= 0) continue;

      next = {
        ...next,
        items: next.items.map(i => i.id === line.itemId ? { ...i, quantity: i.quantity + qty } : i),
      };

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
    saveState(next);
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
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isSuccess ? 'bg-white/20' : 'bg-white/20'
          }`}>
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

      {/* Camera / Scanner block */}
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

        {/* Manual input */}
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

          return (
            <div
              key={line.id}
              className={`rounded-xl border p-3 transition-all ${
                done ? 'border-success/40 bg-success/8' :
                partial ? 'border-amber-500/40 bg-amber-500/8' :
                'border-border bg-card'
              }`}
            >
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
                    {loc && <span className="flex items-center gap-0.5"><Icon name="MapPin" size={9} />{loc.name}</span>}
                    {line.isNew && <span className="text-primary font-medium">Новый</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Manual qty controls */}
                  <button
                    onClick={() => handleManualQty(line.id, -1)}
                    disabled={confirmed <= 0}
                    className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <Icon name="Minus" size={12} />
                  </button>

                  <div className="text-center min-w-[52px]">
                    <span className={`text-base font-bold tabular-nums ${done ? 'text-success' : partial ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                      {confirmed}
                    </span>
                    <span className="text-muted-foreground text-sm">/{line.qty}</span>
                    <div className="text-[10px] text-muted-foreground">{line.unit}</div>
                  </div>

                  <button
                    onClick={() => handleManualQty(line.id, +1)}
                    disabled={confirmed >= line.qty}
                    className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <Icon name="Plus" size={12} />
                  </button>
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