import { useState, useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppState, loadState } from '@/data/store';
import Layout, { Page } from '@/components/Layout';
import CatalogPage from '@/pages/CatalogPage';
import NomenclaturePage from '@/pages/NomenclaturePage';
import AssemblyPage from '@/pages/AssemblyPage';
import PartnersPage from '@/pages/PartnersPage';
import WarehouseMapPage from '@/pages/WarehouseMapPage';
import ReceiptsPage from '@/pages/ReceiptsPage';
import TechnicianPage from '@/pages/TechnicianPage';
import HistoryPage from '@/pages/HistoryPage';
import SettingsPage from '@/pages/SettingsPage';

function parseQRParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    itemId: params.get('item'),
    locationId: params.get('location'),
    orderId: params.get('order'),
  };
}

export default function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [page, setPage] = useState<Page>('catalog');

  const [qrItemId, setQrItemId] = useState<string | null>(null);
  const [qrLocationId, setQrLocationId] = useState<string | null>(null);
  const [qrOrderId, setQrOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (state.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [state.darkMode]);

  useEffect(() => {
    const { itemId, locationId, orderId } = parseQRParams();
    if (itemId) { setQrItemId(itemId); setPage('catalog'); }
    else if (locationId) { setQrLocationId(locationId); setPage('warehouse'); }
    else if (orderId) { setQrOrderId(orderId); setPage('assembly'); }
    if (itemId || locationId || orderId) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Handle QR scan results from Layout's scanner
  const handleQRResult = (type: string, id: string) => {
    if (type === 'item')     { setQrItemId(id); setPage('catalog'); }
    if (type === 'location') { setQrLocationId(id); setPage('warehouse'); }
    if (type === 'order')    { setQrOrderId(id); setPage('assembly'); }
  };

  const handlePageChange = (p: Page) => {
    setPage(p);
    if (p !== 'catalog')   setQrItemId(null);
    if (p !== 'warehouse') setQrLocationId(null);
    if (p !== 'assembly')  setQrOrderId(null);
  };

  return (
    <TooltipProvider>
      <Toaster position="top-right" />
      <Layout
        state={state}
        onStateChange={setState}
        activePage={page}
        onPageChange={handlePageChange}
        onQRResult={handleQRResult}
      >
        {page === 'catalog'      && <CatalogPage state={state} onStateChange={setState} initialItemId={qrItemId} />}
        {page === 'nomenclature' && <NomenclaturePage state={state} onStateChange={setState} />}
        {page === 'assembly'     && <AssemblyPage state={state} onStateChange={setState} initialOrderId={qrOrderId} />}
        {page === 'warehouse'    && <WarehouseMapPage state={state} onStateChange={setState} initialLocationId={qrLocationId} />}
        {page === 'receipts'     && <ReceiptsPage state={state} onStateChange={setState} />}
        {page === 'technician'   && <TechnicianPage state={state} onStateChange={setState} />}
        {page === 'partners'     && <PartnersPage state={state} onStateChange={setState} />}
        {page === 'history'      && <HistoryPage state={state} />}
        {page === 'settings'     && <SettingsPage state={state} onStateChange={setState} />}
      </Layout>
    </TooltipProvider>
  );
}