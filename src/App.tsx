import { useState, useEffect, useRef, useCallback } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppState, loadState, saveState, loadStateFromServer } from '@/data/store';
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

const POLL_INTERVAL = 5000;

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

  // Храним последний известный updatedAt с сервера чтобы не перезаписывать свежие локальные изменения
  const serverUpdatedAtRef = useRef<string | null>(null);
  // Время последнего локального изменения (saveState)
  const lastLocalSaveRef = useRef<number>(0);

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

  // Загрузка с сервера при старте — перезаписываем localStorage данные если сервер новее
  useEffect(() => {
    loadStateFromServer().then(result => {
      if (!result) return;
      serverUpdatedAtRef.current = result.updatedAt;
      setState(result.state);
      saveState(result.state);
    });
  }, []);

  // Polling — каждые 5 сек проверяем updatedAt на сервере
  const poll = useCallback(async () => {
    // Не перезаписываем если только что было локальное изменение (< 3 сек назад)
    if (Date.now() - lastLocalSaveRef.current < 3000) return;

    const result = await loadStateFromServer();
    if (!result) return;
    // Обновляем только если сервер вернул новую версию
    if (result.updatedAt !== serverUpdatedAtRef.current) {
      serverUpdatedAtRef.current = result.updatedAt;
      setState(result.state);
      saveState(result.state);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [poll]);

  // Перехватываем onStateChange чтобы отметить время локального изменения
  const handleStateChange = useCallback((s: AppState) => {
    lastLocalSaveRef.current = Date.now();
    setState(s);
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
        onStateChange={handleStateChange}
        activePage={page}
        onPageChange={handlePageChange}
        onQRResult={handleQRResult}
      >
        {page === 'catalog'      && <CatalogPage state={state} onStateChange={handleStateChange} initialItemId={qrItemId} />}
        {page === 'nomenclature' && <NomenclaturePage state={state} onStateChange={handleStateChange} />}
        {page === 'assembly'     && <AssemblyPage state={state} onStateChange={handleStateChange} initialOrderId={qrOrderId} />}
        {page === 'warehouse'    && <WarehouseMapPage state={state} onStateChange={handleStateChange} initialLocationId={qrLocationId} />}
        {page === 'receipts'     && <ReceiptsPage state={state} onStateChange={handleStateChange} />}
        {page === 'technician'   && <TechnicianPage state={state} onStateChange={handleStateChange} />}
        {page === 'partners'     && <PartnersPage state={state} onStateChange={handleStateChange} />}
        {page === 'history'      && <HistoryPage state={state} />}
        {page === 'settings'     && <SettingsPage state={state} onStateChange={handleStateChange} />}
      </Layout>
    </TooltipProvider>
  );
}
