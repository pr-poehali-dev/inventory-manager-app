import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';

export type ScannedCode = {
  code: string;
  format?: string;
  scannedAt: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (codes: ScannedCode[]) => void;
  title?: string;
  itemBarcodes?: string[]; // known codes for this item
  mode?: 'in' | 'out';    // out = only known codes allowed
};

export default function ScannerModal({ open, onClose, onConfirm, title = 'Сканирование', itemBarcodes = [], mode }: Props) {
  const [scanned, setScanned] = useState<ScannedCode[]>([]);
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [lastFlash, setLastFlash] = useState(false);
  const [rejectFlash, setRejectFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastCodeRef = useRef<string>('');
  const lastCodeTimeRef = useRef<number>(0);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setScanned([]);
      setManualCode('');
      setCameraError('');
    }
  }, [open, stopCamera]);

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  const addCode = useCallback((code: string, format?: string) => {
    const now = Date.now();
    // Дедупликация: тот же код не чаще 1 раза в 2 сек
    if (code === lastCodeRef.current && now - lastCodeTimeRef.current < 2000) return;
    lastCodeRef.current = code;
    lastCodeTimeRef.current = now;

    // При расходе — пропускаем коды не из базы
    if (mode === 'out' && itemBarcodes.length > 0 && !itemBarcodes.includes(code)) {
      setRejectFlash(true);
      setTimeout(() => setRejectFlash(false), 400);
      return;
    }

    setLastFlash(true);
    setTimeout(() => setLastFlash(false), 300);

    setScanned(prev => [...prev, { code, format, scannedAt: new Date().toISOString() }]);
  }, [mode, itemBarcodes]);

  const startCamera = async () => {
    setCameraError('');
    if (typeof BarcodeDetector === 'undefined') {
      setCameraError('Ваш браузер не поддерживает встроенный сканер. Введите код вручную.');
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
              if (b.rawValue) addCode(b.rawValue, b.format);
            }
          } catch { /* ignore decode errors */ }
        }
        animFrameRef.current = requestAnimationFrame(scan);
      };
      animFrameRef.current = requestAnimationFrame(scan);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setCameraError('Нет доступа к камере. Разрешите доступ в настройках браузера.');
      } else {
        setCameraError('Не удалось открыть камеру: ' + msg);
      }
    }
  };

  const handleManualAdd = () => {
    const code = manualCode.trim();
    if (!code) return;
    addCode(code, 'manual');
    setManualCode('');
  };

  const removeCode = (idx: number) => {
    setScanned(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = () => {
    onConfirm(scanned);
    onClose();
  };

  // Group: count same codes
  const grouped = scanned.reduce<Record<string, { code: string; format?: string; count: number; lastIdx: number }>>((acc, s, i) => {
    if (acc[s.code]) {
      acc[s.code].count++;
      acc[s.code].lastIdx = i;
    } else {
      acc[s.code] = { code: s.code, format: s.format, count: 1, lastIdx: i };
    }
    return acc;
  }, {});

  const totalCount = scanned.length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden animate-scale-in">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Icon name="ScanLine" size={16} />
            </div>
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pt-4 pb-5 space-y-4">
          {/* Out-mode hint */}
          {mode === 'out' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/25 rounded-lg text-xs text-destructive">
              <Icon name="ShieldAlert" size={13} className="shrink-0" />
              Коды, не привязанные к этому товару, будут отклонены
            </div>
          )}

          {/* Camera viewport */}
          <div className={`relative rounded-xl overflow-hidden bg-black aspect-video transition-all ${lastFlash ? 'ring-4 ring-success' : rejectFlash ? 'ring-4 ring-destructive' : ''}`}>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              style={{ display: cameraActive ? 'block' : 'none' }}
            />
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/30">
                <div className="w-16 h-16 rounded-2xl bg-background/80 flex items-center justify-center">
                  <Icon name="Camera" size={28} className="text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground text-center px-4">
                  Нажмите «Включить камеру»<br/>для сканирования кодов
                </p>
                {cameraError && (
                  <div className="mx-4 px-3 py-2 bg-destructive/10 rounded-lg text-xs text-destructive text-center">
                    {cameraError}
                  </div>
                )}
              </div>
            )}
            {cameraActive && (
              <>
                {/* Scanning guide overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-[20%] border-2 border-white/60 rounded-xl" />
                  <div className="absolute top-[20%] left-[20%] w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                  <div className="absolute top-[20%] right-[20%] w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-[20%] left-[20%] w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-[20%] right-[20%] w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg" />
                </div>
                <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                  <button onClick={stopCamera}
                    className="px-3 py-1.5 bg-black/60 text-white text-xs rounded-lg flex items-center gap-1.5 hover:bg-black/80">
                    <Icon name="CameraOff" size={12} />Выключить камеру
                  </button>
                </div>
                {lastFlash && (
                  <div className="absolute inset-0 bg-success/20 pointer-events-none animate-pulse" />
                )}
                {rejectFlash && (
                  <div className="absolute inset-0 bg-destructive/30 pointer-events-none animate-pulse" />
                )}
              </>
            )}
          </div>

          {/* Camera button */}
          {!cameraActive && (
            <Button onClick={startCamera} className="w-full" variant="outline">
              <Icon name="Camera" size={15} className="mr-2" />
              Включить камеру
            </Button>
          )}

          {/* Manual input */}
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground font-medium">Ввести код вручную</div>
            <div className="flex gap-2">
              <Input
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualAdd()}
                placeholder="Введите штрих-код или QR..."
                className="flex-1"
              />
              <Button onClick={handleManualAdd} variant="outline" disabled={!manualCode.trim()}>
                <Icon name="Plus" size={15} />
              </Button>
            </div>
          </div>

          {/* Scanned list */}
          {totalCount > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-foreground">
                  Отсканировано: <span className="text-primary font-bold">{totalCount}</span> шт
                </div>
                <button onClick={() => setScanned([])}
                  className="text-xs text-destructive hover:underline">
                  Очистить всё
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {Object.values(grouped).map(({ code, format, count }) => {
                  const isKnown = itemBarcodes.includes(code);
                  return (
                    <div key={code} className={`flex items-center gap-2.5 p-2 rounded-lg border text-sm
                      ${isKnown ? 'bg-success/8 border-success/30' : 'bg-muted/50 border-border'}`}>
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0
                        ${isKnown ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>
                        <Icon name={format === 'qr_code' ? 'QrCode' : 'Barcode'} size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs font-medium truncate">{code}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {format && format !== 'manual' ? format.toUpperCase().replace('_', '-') : 'вручную'}
                          {!isKnown && <span className="ml-1.5 text-warning">новый код</span>}
                          {count > 1 && <span className="ml-1.5 font-semibold text-primary">×{count}</span>}
                        </div>
                      </div>
                      <button onClick={() => {
                        // Remove last occurrence of this code
                        setScanned(prev => {
                          const idx = [...prev].reverse().findIndex(s => s.code === code);
                          if (idx === -1) return prev;
                          const realIdx = prev.length - 1 - idx;
                          return prev.filter((_, i) => i !== realIdx);
                        });
                      }}
                        className="w-6 h-6 rounded-md hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground shrink-0">
                        <Icon name="X" size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Отмена
            </Button>
            <Button onClick={handleConfirm} className="flex-1" disabled={totalCount === 0}>
              <Icon name="Check" size={15} className="mr-1.5" />
              Подтвердить {totalCount > 0 ? `(${totalCount})` : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Declare BarcodeDetector for TS
declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<{ rawValue: string; format: string }[]>;
  static getSupportedFormats(): Promise<string[]>;
}