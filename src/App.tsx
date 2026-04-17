import { useState, useEffect, useRef, useCallback } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppState, loadState, saveLocal, loadStateFromServer, checkServerUpdatedAt, getLastCrudAt, crudAction } from '@/data/store';
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

  const mergeServerState = useCallback((local: AppState, server: AppState): AppState => {
    const arrayKeys: (keyof AppState)[] = [
      'items', 'categories', 'locations', 'operations', 'warehouses',
      'partners', 'barcodes', 'locationStocks', 'warehouseStocks',
      'workOrders', 'receipts', 'techDocs', 'invoiceTemplates',
    ];
    const mergeById = (loc: Array<Record<string, unknown>>, srv: Array<Record<string, unknown>>) => {
      const locById = new Map(loc.map(x => [x.id as string, x]));
      const result = srv.map(sObj => {
        const lObj = locById.get(sObj.id as string);
        if (!lObj) return sObj;
        const merged: Record<string, unknown> = { ...lObj };
        for (const [k, v] of Object.entries(sObj)) {
          const lv = (lObj as Record<string, unknown>)[k];
          const serverHas = v !== null && v !== undefined && v !== '';
          const localHas = lv !== null && lv !== undefined && lv !== '';
          if (serverHas) merged[k] = v;
          else if (localHas) merged[k] = lv;
          else merged[k] = v;
        }
        return merged;
      });
      const srvIds = new Set(srv.map(x => x.id as string));
      for (const lObj of loc) {
        if (!srvIds.has(lObj.id as string)) result.push(lObj);
      }
      return result;
    };
    const merged: AppState = { ...local, ...server };
    for (const k of arrayKeys) {
      const srv = (server[k] as Array<Record<string, unknown>>) || [];
      const loc = (local[k] as Array<Record<string, unknown>>) || [];
      if ((!srv || srv.length === 0) && loc.length > 0) {
        (merged as Record<string, unknown>)[k as string] = loc;
        continue;
      }
      const hasId = srv.length > 0 && 'id' in srv[0];
      if (hasId && loc.length > 0) {
        (merged as Record<string, unknown>)[k as string] = mergeById(loc, srv);
      }
    }
    return merged;
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
      setState(prev => {
        const merged = mergeServerState(prev, result.state);
        saveLocal(merged);
        const srvWh = result.state.warehouses || [];
        const locWh = prev.warehouses || [];
        if (srvWh.length === 0 && locWh.length > 0) {
          locWh.forEach(w => { crudAction('upsert_warehouse', { warehouse: w }); });
        }
        const srvCats = result.state.categories || [];
        const locCats = prev.categories || [];
        if (srvCats.length === 0 && locCats.length > 0) {
          locCats.forEach(c => { crudAction('upsert_category', { category: c }); });
        }
        const srvLocs = result.state.locations || [];
        const locLocs = prev.locations || [];
        if (srvLocs.length === 0 && locLocs.length > 0) {
          locLocs.forEach(l => { crudAction('upsert_location', { location: l }); });
        }
        const srvItems = result.state.items || [];
        const locItems = prev.items || [];
        if (srvItems.length === 0 && locItems.length > 0) {
          locItems.forEach(i => { crudAction('upsert_item', { item: i }); });
        }
        return merged;
      });
    });
  }, [mergeServerState]);

  const poll = useCallback(async () => {
    const lastChange = Math.max(lastLocalSaveRef.current, getLastCrudAt());
    if (Date.now() - lastChange < 8000) return;
    const remoteTs = await checkServerUpdatedAt();
    if (!remoteTs) return;
    if (remoteTs === serverUpdatedAtRef.current) return;
    if (Date.now() - Math.max(lastLocalSaveRef.current, getLastCrudAt()) < 8000) return;
    const result = await loadStateFromServer();
    if (!result) return;
    serverUpdatedAtRef.current = result.updatedAt;
    setState(prev => {
      const merged = mergeServerState(prev, result.state);
      saveLocal(merged);
      return merged;
    });
  }, [mergeServerState]);

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