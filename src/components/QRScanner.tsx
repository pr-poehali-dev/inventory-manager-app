import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

type ScanResult = {
  type: 'item' | 'location' | 'order' | 'receipt' | 'unknown';
  id: string;
  raw: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onResult: (result: ScanResult) => void;
};

function parseQRResult(raw: string): ScanResult {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const item = url.searchParams.get('item');
    const location = url.searchParams.get('location');
    const order = url.searchParams.get('order');
    const receipt = url.searchParams.get('receipt');
    if (item)     return { type: 'item',     id: item,     raw: trimmed };
    if (location) return { type: 'location', id: location, raw: trimmed };
    if (order)    return { type: 'order',    id: order,    raw: trimmed };
    if (receipt)  return { type: 'receipt',  id: receipt,  raw: trimmed };
  } catch { /* not a URL */ }
  return { type: 'unknown', id: trimmed, raw: trimmed };
}

const SCAN_LABELS: Record<ScanResult['type'], string> = {
  item:     'Товар',
  location: 'Локация',
  order:    'Заявка',
  receipt:  'Оприходование',
  unknown:  'Данные',
};

const SCAN_ICONS: Record<ScanResult['type'], string> = {
  item:     'Package',
  location: 'MapPin',
  order:    'ClipboardList',
  receipt:  'FileText',
  unknown:  'ScanLine',
};

export default function QRScanner({ open, onClose, onResult }: Props) {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [cameraList, setCameraList] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // List cameras on open
  useEffect(() => {
    if (!open) return;
    Html5Qrcode.getCameras()
      .then(cameras => {
        setCameraList(cameras.map(c => ({ id: c.id, label: c.label || `Камера ${c.id.slice(-4)}` })));
        // Prefer back camera on mobile
        const back = cameras.find(c => /back|rear|environment/i.test(c.label));
        setSelectedCamera((back || cameras[0])?.id || '');
      })
      .catch(() => {
        setError('Нет доступа к камере. Используйте ручной ввод.');
        setMode('manual');
      });
  }, [open]);

  // Start/stop scanner
  useEffect(() => {
    if (!open || mode !== 'camera' || !selectedCamera) return;

    const scanner = new Html5Qrcode('qr-scanner-container', {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    scannerRef.current = scanner;
    setScanning(true);
    setError(null);

    scanner.start(
      selectedCamera,
      { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
      (decodedText) => {
        const result = parseQRResult(decodedText);
        setLastResult(result);
        // Pause scanning to show result
        scanner.pause(true);
        setScanning(false);
      },
      () => { /* ongoing scan errors are normal */ }
    ).catch((err: unknown) => {
      setError(`Не удалось запустить камеру: ${String(err)}`);
      setScanning(false);
    });

    return () => {
      scanner.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, [open, mode, selectedCamera]);

  const handleClose = () => {
    scannerRef.current?.stop().catch(() => {});
    scannerRef.current = null;
    setLastResult(null);
    setError(null);
    setScanning(false);
    setManualInput('');
    onClose();
  };

  const handleAccept = () => {
    if (lastResult) {
      onResult(lastResult);
      handleClose();
    }
  };

  const handleRescan = () => {
    setLastResult(null);
    setError(null);
    setScanning(true);
    scannerRef.current?.resume();
  };

  const handleManualSubmit = () => {
    if (!manualInput.trim()) return;
    const result = parseQRResult(manualInput.trim());
    setLastResult(result);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm w-full animate-scale-in p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Icon name="ScanLine" size={16} />
            </div>
            QR-сканер
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4 pt-4">
          {/* Mode tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button onClick={() => { setMode('camera'); setLastResult(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all
                ${mode === 'camera' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon name="Camera" size={13} />Камера
            </button>
            <button onClick={() => { setMode('manual'); setLastResult(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all
                ${mode === 'manual' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon name="Keyboard" size={13} />Вручную
            </button>
          </div>

          {/* Camera selector */}
          {mode === 'camera' && cameraList.length > 1 && (
            <select value={selectedCamera} onChange={e => setSelectedCamera(e.target.value)}
              className="w-full h-8 px-2 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {cameraList.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          )}

          {/* Camera view */}
          {mode === 'camera' && !lastResult && (
            <div className="relative">
              <div
                id="qr-scanner-container"
                ref={containerRef}
                className="w-full rounded-xl overflow-hidden bg-black"
                style={{ minHeight: 260 }}
              />
              {/* Scan frame overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg" />
                  {scanning && (
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/80 animate-bounce" />
                  )}
                </div>
              </div>
              {scanning && (
                <div className="absolute bottom-3 inset-x-0 flex justify-center">
                  <div className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                    Наведите камеру на QR-код
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual input */}
          {mode === 'manual' && !lastResult && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Вставьте URL из QR-кода или ID товара/локации:
                </p>
                <div className="flex gap-2">
                  <Input
                    value={manualInput}
                    onChange={e => setManualInput(e.target.value)}
                    placeholder="https://.../?item=abc123"
                    onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                    className="text-sm"
                    autoFocus
                  />
                  <Button onClick={handleManualSubmit} disabled={!manualInput.trim()} size="sm">
                    <Icon name="ArrowRight" size={14} />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
              <Icon name="AlertCircle" size={14} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Result */}
          {lastResult && (
            <div className="space-y-3 animate-scale-in">
              <div className="p-4 bg-success/8 border border-success/30 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success/15 text-success flex items-center justify-center shrink-0">
                  <Icon name={SCAN_ICONS[lastResult.type]} size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">{SCAN_LABELS[lastResult.type]} найден</div>
                  <div className="font-bold text-sm text-foreground truncate">{lastResult.raw}</div>
                  {lastResult.id !== lastResult.raw && (
                    <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">ID: {lastResult.id}</div>
                  )}
                </div>
                <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center shrink-0">
                  <Icon name="Check" size={12} className="text-success-foreground" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleRescan} className="flex-1 gap-1.5">
                  <Icon name="RefreshCw" size={13} />Снова
                </Button>
                <Button onClick={handleAccept}
                  className="flex-1 bg-success hover:bg-success/90 text-success-foreground font-semibold gap-1.5">
                  <Icon name="CheckCircle2" size={14} />Перейти
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
