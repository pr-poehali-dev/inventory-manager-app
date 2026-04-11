import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import {
  AppState, Item, crudAction, generateId,
  WorkOrder, OrderItem, OrderStatus, Operation,
  updateLocationStock,
} from '@/data/store';

declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(source: HTMLVideoElement): Promise<{ rawValue: string; format: string }[]>;
}

export default function QRScanModal({ order, state, onStateChange, onClose }: {
  order: WorkOrder; state: AppState;
  onStateChange: (s: AppState) => void; onClose: () => void;
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [lastFlash, setLastFlash] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [foundItem, setFoundItem] = useState<{ item: Item; locationId?: string } | null>(null);
  const [qty, setQty] = useState('1');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [step, setStep] = useState<'scan' | 'confirm'>('scan');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastRawRef = useRef('');
  const lastTimeRef = useRef(0);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const resolveItem = useCallback((raw: string): Item | null => {
    const trimmed = raw.trim();
    try {
      const url = new URL(trimmed);
      const itemId = url.searchParams.get('item');
      if (itemId) return state.items.find(i => i.id === itemId) || null;
    } catch (_) { /* not url */ }
    const byBarcode = (state.barcodes || []).find(b => b.code === trimmed);
    if (byBarcode) return state.items.find(i => i.id === byBarcode.itemId) || null;
    const byId = state.items.find(i => i.id === trimmed);
    if (byId) return byId;
    return state.items.find(i => i.name.toLowerCase() === trimmed.toLowerCase()) || null;
  }, [state.items, state.barcodes]);

  const handleFoundItem = useCallback((item: Item, locId?: string) => {
    setFoundItem({ item, locationId: locId });
    const stocks = (state.locationStocks || []).filter(ls => ls.itemId === item.id && ls.quantity > 0);
    if (locId) setSelectedLocationId(locId);
    else if (stocks.length === 1) setSelectedLocationId(stocks[0].locationId);
    setQty('1');
    setStep('confirm');
    stopCamera();
  }, [state.locationStocks, stopCamera]);

  const startCamera = async () => {
    setCameraError('');
    if (typeof BarcodeDetector === 'undefined') {
      setCameraError('Браузер не поддерживает встроенный сканер. Введите код вручную.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (BarcodeDetector as any)({ formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'data_matrix'] });
      setCameraActive(true);
      const scan = async () => {
        if (!videoRef.current) return;
        if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          try {
            const codes = await detector.detect(videoRef.current);
            for (const c of codes) {
              const now = Date.now();
              if (c.rawValue === lastRawRef.current && now - lastTimeRef.current < 2000) continue;
              lastRawRef.current = c.rawValue;
              lastTimeRef.current = now;
              const item = resolveItem(c.rawValue);
              if (item) {
                setLastFlash(true); setTimeout(() => setLastFlash(false), 300);
                handleFoundItem(item);
                return;
              }
            }
          } catch { /* ignore */ }
        }
        animFrameRef.current = requestAnimationFrame(scan);
      };
      animFrameRef.current = requestAnimationFrame(scan);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCameraError(msg.includes('Permission') || msg.includes('NotAllowed')
        ? 'Нет доступа к камере. Разрешите доступ в настройках браузера.'
        : 'Не удалось открыть камеру: ' + msg);
    }
  };

  const parseManual = () => {
    const item = resolveItem(manualInput);
    if (item) handleFoundItem(item);
    else setCameraError('Товар не найден. Проверьте код или название.');
  };

  const locStocks = foundItem ? (state.locationStocks || [])
    .filter(ls => ls.itemId === foundItem.item.id && ls.quantity > 0)
    .map(ls => ({ ...ls, location: state.locations.find(l => l.id === ls.locationId) }))
    .filter(ls => ls.location) : [];

  const handleConfirm = () => {
    if (!foundItem || !selectedLocationId) return;
    const actual = parseInt(qty) || 0;
    if (actual <= 0) return;
    const locStock = (state.locationStocks || []).find(ls => ls.itemId === foundItem.item.id && ls.locationId === selectedLocationId)?.quantity || 0;
    const pickQty = Math.min(actual, locStock);
    if (pickQty <= 0) return;
    const liveOrder = state.workOrders.find(o => o.id === order.id) || order;
    const existingOi = liveOrder.items.find(oi => oi.itemId === foundItem.item.id);
    let newItems: OrderItem[];
    if (existingOi) {
      const newPicked = existingOi.pickedQty + pickQty;
      const newStatus: OrderItem['status'] = newPicked >= existingOi.requiredQty ? 'done' : 'partial';
      newItems = liveOrder.items.map(oi => oi.id === existingOi.id ? { ...oi, pickedQty: newPicked, status: newStatus } : oi);
    } else {
      newItems = [...liveOrder.items, { id: generateId(), itemId: foundItem.item.id, requiredQty: pickQty, pickedQty: pickQty, status: 'done' as OrderItem['status'] }];
    }
    const allDone = newItems.every(oi => oi.status === 'done');
    let next = updateLocationStock(state, foundItem.item.id, selectedLocationId, -pickQty);
    next = { ...next, items: next.items.map(i => i.id === foundItem.item.id ? { ...i, quantity: Math.max(0, i.quantity - pickQty) } : i) };
    const op: Operation = {
      id: generateId(), itemId: foundItem.item.id, type: 'out', quantity: pickQty,
      comment: `Сканирование — сборка по заявке ${liveOrder.number}`,
      from: state.locations.find(l => l.id === selectedLocationId)?.name,
      to: liveOrder.recipientName || liveOrder.title,
      performedBy: state.currentUser, date: new Date().toISOString(), orderId: liveOrder.id, locationId: selectedLocationId,
    };
    const updatedWorkOrder = { ...liveOrder, items: newItems, status: allDone ? 'assembled' as OrderStatus : liveOrder.status, updatedAt: new Date().toISOString() };
    next = { ...next, operations: [op, ...next.operations], workOrders: next.workOrders.map(o => o.id === liveOrder.id ? updatedWorkOrder : o) };
    onStateChange(next);
    const updatedItem = next.items.find(i => i.id === foundItem.item.id);
    const updatedLocationStocks = (next.locationStocks || []).filter(ls => ls.itemId === foundItem.item.id);
    crudAction('upsert_work_order', { workOrder: updatedWorkOrder, orderItems: updatedWorkOrder.items });
    crudAction('upsert_operation', { operation: op, item: updatedItem, locationStocks: updatedLocationStocks });
    onClose();
  };

  return (
    <Dialog open onOpenChange={() => { stopCamera(); onClose(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden animate-scale-in">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Icon name="ScanLine" size={16} />
            </div>
            Сканировать товар
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pt-4 pb-5 space-y-4">
          {step === 'scan' ? (<>
            <div className={`relative rounded-xl overflow-hidden bg-black aspect-video transition-all ${lastFlash ? 'ring-4 ring-success' : ''}`}>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted style={{ display: cameraActive ? 'block' : 'none' }} />
              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/20">
                  <div className="w-16 h-16 rounded-2xl bg-background/80 flex items-center justify-center">
                    <Icon name="Camera" size={28} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center px-4">Нажмите «Включить камеру» для сканирования</p>
                  {cameraError && <div className="mx-4 px-3 py-2 bg-destructive/10 rounded-lg text-xs text-destructive text-center">{cameraError}</div>}
                </div>
              )}
              {cameraActive && (
                <>
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-[20%] border-2 border-white/50 rounded-xl" />
                    <div className="absolute top-[20%] left-[20%] w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                    <div className="absolute top-[20%] right-[20%] w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-[20%] left-[20%] w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-[20%] right-[20%] w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg" />
                  </div>
                  <button onClick={stopCamera}
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/60 text-white text-xs rounded-lg flex items-center gap-1.5 hover:bg-black/80">
                    <Icon name="CameraOff" size={12} />Выключить
                  </button>
                </>
              )}
            </div>

            {!cameraActive && (
              <button onClick={startCamera}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/4 hover:bg-primary/8 hover:border-primary/60 transition-all text-sm font-semibold text-primary">
                <Icon name="Camera" size={16} />Включить камеру
              </button>
            )}

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground shrink-0">или введите вручную</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="flex gap-2">
              <Input value={manualInput} onChange={e => { setManualInput(e.target.value); setCameraError(''); }}
                onKeyDown={e => e.key === 'Enter' && parseManual()}
                placeholder="Штрих-код, QR-код, ID или название..." className="flex-1" />
              <button onClick={parseManual} disabled={!manualInput.trim()}
                className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 shrink-0">
                <Icon name="Search" size={15} />
              </button>
            </div>

            {order.items.filter(oi => oi.status !== 'done').length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground font-medium">Быстрый выбор из заявки:</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {order.items.filter(oi => oi.status !== 'done').map(oi => {
                    const it = state.items.find(i => i.id === oi.itemId);
                    if (!it) return null;
                    return (
                      <button key={oi.id} onClick={() => handleFoundItem(it)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-sm transition-colors">
                        <span className="font-medium truncate">{it.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">{oi.requiredQty - oi.pickedQty} {it.unit}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Button variant="outline" onClick={() => { stopCamera(); onClose(); }} className="w-full">Отмена</Button>
          </>) : foundItem ? (
            <div className="space-y-4">
              <div className="p-3 bg-success/8 border border-success/20 rounded-xl">
                <div className="flex items-center gap-2 text-success font-semibold text-sm mb-1">
                  <Icon name="CheckCircle2" size={15} />Товар найден
                </div>
                <div className="font-bold text-foreground">{foundItem.item.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Всего на складе: {foundItem.item.quantity} {foundItem.item.unit}
                </div>
              </div>

              {locStocks.length === 0 ? (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive flex items-center gap-2">
                  <Icon name="AlertCircle" size={14} />Нет в наличии на складе
                </div>
              ) : locStocks.length > 1 ? (
                <div className="space-y-1.5">
                  <Label>Выберите локацию</Label>
                  {locStocks.map(ls => (
                    <button key={ls.locationId} onClick={() => setSelectedLocationId(ls.locationId)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg border-2 text-sm transition-all
                        ${selectedLocationId === ls.locationId ? 'border-primary bg-accent' : 'border-border bg-card hover:border-primary/40'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedLocationId === ls.locationId ? 'border-primary bg-primary' : 'border-border'}`}>
                          {selectedLocationId === ls.locationId && <Icon name="Check" size={8} className="text-primary-foreground" />}
                        </div>
                        <span className="font-medium">{ls.location?.name}</span>
                      </div>
                      <span className="font-bold tabular-nums text-muted-foreground">{ls.quantity} {foundItem.item.unit}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {selectedLocationId && (
                <div className="space-y-1.5">
                  <Label>Количество</Label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setQty(String(Math.max(1, (parseInt(qty)||0) - 1)))}
                      className="w-10 h-10 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center shrink-0">
                      <Icon name="Minus" size={14} />
                    </button>
                    <Input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} className="text-center text-lg font-bold" />
                    <button type="button" onClick={() => setQty(String((parseInt(qty)||0) + 1))}
                      className="w-10 h-10 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center shrink-0">
                      <Icon name="Plus" size={14} />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setStep('scan'); setFoundItem(null); setSelectedLocationId(''); }} className="flex-1">
                  <Icon name="ArrowLeft" size={13} className="mr-1" />Назад
                </Button>
                <Button onClick={handleConfirm} disabled={!selectedLocationId || (parseInt(qty)||0) <= 0}
                  className="flex-1 bg-success hover:bg-success/90 text-success-foreground font-semibold">
                  <Icon name="PackageCheck" size={14} className="mr-1.5" />Собрать
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
