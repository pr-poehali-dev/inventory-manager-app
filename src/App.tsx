import { useState, useEffect, useRef, useCallback } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppState, loadState, saveLocal, loadStateFromServer, checkServerUpdatedAt } from '@/data/store';
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
import DashboardPage from '@/pages/DashboardPage';
import InventoryPage from '@/pages/InventoryPage';
import LabelsPage from '@/pages/LabelsPage';
import AuditPage from '@/pages/AuditPage';
import DocumentsPage from '@/pages/DocumentsPage';
import InvoiceTemplatePage from '@/pages/InvoiceTemplatePage';
import { AuthContext, AuthUser, apiLogin, apiLogout, apiMe, setToken, getToken } from '@/data/auth';
import LoginPage from '@/pages/LoginPage';
import Icon from '@/components/ui/icon';

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
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setAuthLoading(false); return; }
    apiMe().then(user => {
      setAuthUser(user);
      setAuthLoading(false);
    });
  }, []);

  const login = async (username: string, password: string): Promise<string | null> => {
    const result = await apiLogin(username, password);
    if ('error' in result) return result.error;
    setToken(result.token);
    setAuthUser(result.user);
    setState(prev => ({ ...prev, currentUser: result.user.displayName }));
    return null;
  };

  const logout = async () => {
    await apiLogout();
    setAuthUser(null);
  };

  const refreshAuth = async () => {
    const user = await apiMe();
    setAuthUser(user);
  };

  const canEdit = authUser?.role === 'admin' || authUser?.role === 'warehouse';
  const isAdmin = authUser?.role === 'admin';

  const authCtx = {
    user: authUser,
    loading: authLoading,
    login,
    logout,
    refresh: refreshAuth,
    canEdit,
    isAdmin,
  };

  const [state, setState] = useState<AppState>(loadState);
  const [page, setPage] = useState<Page>('catalog');

  const [qrItemId, setQrItemId] = useState<string | null>(null);
  const [qrLocationId, setQrLocationId] = useState<string | null>(null);
  const [qrOrderId, setQrOrderId] = useState<string | null>(null);

  const serverUpdatedAtRef = useRef<string | null>(null);
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

  useEffect(() => {
    loadStateFromServer().then(result => {
      if (!result) return;
      const localRaw = localStorage.getItem('stockbase_state');
      const localTs = localRaw ? (JSON.parse(localRaw)._savedAt || '') : '';
      const serverTs = result.updatedAt || '';
      if (localTs && serverTs && localTs > serverTs) {
        serverUpdatedAtRef.current = serverTs;
        return;
      }
      serverUpdatedAtRef.current = result.updatedAt;
      setState(result.state);
      saveLocal(result.state);
    });
  }, []);

  const poll = useCallback(async () => {
    if (Date.now() - lastLocalSaveRef.current < 3000) return;
    const remoteTs = await checkServerUpdatedAt();
    if (!remoteTs) return;
    if (remoteTs === serverUpdatedAtRef.current) return;
    const result = await loadStateFromServer();
    if (!result) return;
    serverUpdatedAtRef.current = result.updatedAt;
    setState(result.state);
    saveLocal(result.state);
  }, []);

  useEffect(() => {
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [poll]);

  const handleStateChange = useCallback((s: AppState) => {
    lastLocalSaveRef.current = Date.now();
    setState(s);
  }, []);

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
    <AuthContext.Provider value={authCtx}>
      {authLoading ? (
        <div className="min-h-screen flex items-center justify-center">
          <Icon name="Loader2" size={32} className="animate-spin text-primary" />
        </div>
      ) : !authUser ? (
        <LoginPage />
      ) : (
      <TooltipProvider>
        <Toaster position="top-right" />
        <Layout
          state={state}
          onStateChange={handleStateChange}
          activePage={page}
          onPageChange={handlePageChange}
          onQRResult={handleQRResult}
        >
          {page === 'dashboard'    && <DashboardPage state={state} />}
          {page === 'catalog'      && <CatalogPage state={state} onStateChange={handleStateChange} initialItemId={qrItemId} />}
          {page === 'nomenclature' && <NomenclaturePage state={state} onStateChange={handleStateChange} />}
          {page === 'assembly'     && <AssemblyPage state={state} onStateChange={handleStateChange} initialOrderId={qrOrderId} />}
          {page === 'warehouse'    && <WarehouseMapPage state={state} onStateChange={handleStateChange} initialLocationId={qrLocationId} />}
          {page === 'receipts'     && <ReceiptsPage state={state} onStateChange={handleStateChange} />}
          {page === 'documents'    && <DocumentsPage state={state} onStateChange={handleStateChange} />}
          {page === 'invoice'     && <InvoiceTemplatePage state={state} onStateChange={handleStateChange} />}
          {page === 'inventory'    && <InventoryPage state={state} onStateChange={handleStateChange} />}
          {page === 'technician'   && <TechnicianPage state={state} onStateChange={handleStateChange} />}
          {page === 'partners'     && <PartnersPage state={state} onStateChange={handleStateChange} />}
          {page === 'labels'       && <LabelsPage state={state} />}
          {page === 'history'      && <HistoryPage state={state} />}
          {page === 'audit'        && <AuditPage state={state} />}
          {page === 'settings'     && <SettingsPage state={state} onStateChange={handleStateChange} />}
        </Layout>
      </TooltipProvider>
      )}
    </AuthContext.Provider>
  );
}