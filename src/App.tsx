import { useState, useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppState, loadState } from '@/data/store';
import Layout, { Page } from '@/components/Layout';
import CatalogPage from '@/pages/CatalogPage';
import NomenclaturePage from '@/pages/NomenclaturePage';
import AssemblyPage from '@/pages/AssemblyPage';
import PartnersPage from '@/pages/PartnersPage';
import HistoryPage from '@/pages/HistoryPage';
import SettingsPage from '@/pages/SettingsPage';

export default function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [page, setPage] = useState<Page>('catalog');

  useEffect(() => {
    if (state.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [state.darkMode]);

  return (
    <TooltipProvider>
      <Toaster position="top-right" />
      <Layout state={state} onStateChange={setState} activePage={page} onPageChange={setPage}>
        {page === 'catalog'      && <CatalogPage state={state} onStateChange={setState} />}
        {page === 'nomenclature' && <NomenclaturePage state={state} onStateChange={setState} />}
        {page === 'assembly'     && <AssemblyPage state={state} onStateChange={setState} />}
        {page === 'partners'     && <PartnersPage state={state} onStateChange={setState} />}
        {page === 'history'      && <HistoryPage state={state} />}
        {page === 'settings'     && <SettingsPage state={state} onStateChange={setState} />}
      </Layout>
    </TooltipProvider>
  );
}