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
import HistoryPage from '@/pages/HistoryPage';
import SettingsPage from '@/pages/SettingsPage';

// QR deep-link: ?item=ID → открыть карточку товара
//               ?location=ID → открыть карту склада с нужной локацией
//               ?order=ID → открыть заявку
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

  // Deep-link state for QR scan routing
  const [qrItemId, setQrItemId] = useState<string | null>(null);
  const [qrLocationId, setQrLocationId] = useState<string | null>(null);
  const [qrOrderId, setQrOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (state.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [state.darkMode]);

  // Handle QR scan deep-links on mount
  useEffect(() => {
    const { itemId, locationId, orderId } = parseQRParams();
    if (itemId) {
      setQrItemId(itemId);
      setPage('catalog');
    } else if (locationId) {
      setQrLocationId(locationId);
      setPage('warehouse');
    } else if (orderId) {
      setQrOrderId(orderId);
      setPage('assembly');
    }
    // Clean URL without reload
    if (itemId || locationId || orderId) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  return (
    <TooltipProvider>
      <Toaster position="top-right" />
      <Layout state={state} onStateChange={setState} activePage={page} onPageChange={p => {
        setPage(p);
        // Clear QR state when navigating away
        if (p !== 'catalog') setQrItemId(null);
        if (p !== 'warehouse') setQrLocationId(null);
        if (p !== 'assembly') setQrOrderId(null);
      }}>
        {page === 'catalog'      && <CatalogPage state={state} onStateChange={setState} initialItemId={qrItemId} />}
        {page === 'nomenclature' && <NomenclaturePage state={state} onStateChange={setState} />}
        {page === 'assembly'     && <AssemblyPage state={state} onStateChange={setState} initialOrderId={qrOrderId} />}
        {page === 'warehouse'    && <WarehouseMapPage state={state} onStateChange={setState} initialLocationId={qrLocationId} />}
        {page === 'partners'     && <PartnersPage state={state} onStateChange={setState} />}
        {page === 'history'      && <HistoryPage state={state} />}
        {page === 'settings'     && <SettingsPage state={state} onStateChange={setState} />}
      </Layout>
    </TooltipProvider>
  );
}
