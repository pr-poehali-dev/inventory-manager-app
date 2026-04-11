import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import QRCodeImage from './QRCodeImage';

type Props = {
  open: boolean;
  onClose: () => void;
  value: string;
  title?: string;
};

export default function QRDialog({ open, onClose, value, title }: Props) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  const handleDownload = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('#qr-dialog-canvas canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qr-code.png';
    a.click();
  };

  const handlePrint = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('#qr-dialog-canvas canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><body style="display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0"><img src="${dataUrl}" style="max-width:90vw" onload="window.print();window.close()"/></body></html>`);
    win.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xs w-full animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="QrCode" size={16} />
            {title || 'QR-код'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div id="qr-dialog-canvas" className="bg-white p-3 rounded-xl">
            <QRCodeImage value={value} size={240} />
          </div>
          <p className="text-xs text-muted-foreground text-center break-all max-w-full px-2">{value}</p>
          <div className="flex gap-2 w-full">
            <Button variant="outline" size="sm" className="flex-1" onClick={handleDownload}>
              <Icon name="Download" size={13} className="mr-1.5" />Скачать
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={handlePrint}>
              <Icon name="Printer" size={13} className="mr-1.5" />Печать
            </Button>
          </div>
        </div>
        <a ref={linkRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
