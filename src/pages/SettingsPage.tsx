import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { AppState, crudAction, getEmptyState, saveState, guardState, loadStateFromServer, saveLocal, clearLocalCache } from '@/data/store';
import { toast } from 'sonner';
import { useAuth } from '@/data/auth';
import { ProfileSection, AlertsSection, TelegramSection } from './settings/ProfileSections';
import { WarehousesSection, CategoriesSection, LocationsSection } from './settings/EntitySections';
import UsersSection from './settings/UsersSection';

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
};

export default function SettingsPage({ state, onStateChange }: Props) {
  const { isAdmin } = useAuth();
  const [activeSection, setActiveSection] = useState<'profile' | 'alerts' | 'categories' | 'locations' | 'warehouses' | 'users' | 'telegram' | 'data'>('profile');
  const [userName, setUserName] = useState(state.currentUser);
  const [threshold, setThreshold] = useState(String(state.defaultLowStockThreshold));
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ label: string; onConfirm: () => void } | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncing, setSyncing] = useState(false);

  const handleForceSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await loadStateFromServer();
      if (!result) {
        toast.error('Не удалось загрузить данные с сервера. Проверьте соединение.');
        return;
      }
      clearLocalCache();
      saveLocal(result.state);
      onStateChange(result.state);
      setUserName(result.state.currentUser);
      setThreshold(String(result.state.defaultLowStockThreshold));
      toast.success('Данные успешно синхронизированы с сервером');
    } catch {
      toast.error('Ошибка синхронизации');
    } finally {
      setSyncing(false);
    }
  };

  const saveProfile = () => {
    const next = { ...state, currentUser: userName, defaultLowStockThreshold: parseInt(threshold) || 5 };
    onStateChange(next);
    crudAction('update_settings', { settings: { currentUser: userName, defaultLowStockThreshold: String(threshold) } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDeleteConfirm = (label: string, onConfirm: () => void) => {
    setDeleteConfirm({ label, onConfirm });
  };

  const sections: { id: typeof activeSection; label: string; icon: string }[] = [
    { id: 'profile', label: 'Профиль', icon: 'User' },
    { id: 'alerts', label: 'Уведомления', icon: 'Bell' },
    { id: 'telegram', label: 'Telegram', icon: 'Send' },
    { id: 'warehouses', label: 'Склады', icon: 'Warehouse' },
    { id: 'categories', label: 'Категории', icon: 'Tag' },
    { id: 'locations', label: 'Локации', icon: 'MapPin' },
    ...(isAdmin ? [{ id: 'users' as const, label: 'Пользователи', icon: 'Users' }] : []),
    { id: 'data' as const, label: 'Данные', icon: 'Database' },
  ];

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Настройки</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Управление приложением</p>
      </div>

      <div className="flex flex-col md:flex-row gap-5">
        <div className="md:w-48 shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto pb-1 md:pb-0">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                  ${activeSection === s.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              >
                <Icon name={s.icon} size={15} />
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 animate-fade-in">
          {activeSection === 'profile' && (
            <ProfileSection
              state={state}
              onStateChange={onStateChange}
              userName={userName}
              setUserName={setUserName}
              saved={saved}
              onSave={saveProfile}
            />
          )}

          {activeSection === 'alerts' && (
            <AlertsSection
              state={state}
              threshold={threshold}
              setThreshold={setThreshold}
              saved={saved}
              onSave={saveProfile}
            />
          )}

          {activeSection === 'telegram' && <TelegramSection />}

          {activeSection === 'warehouses' && (
            <WarehousesSection state={state} onStateChange={onStateChange} onDeleteConfirm={handleDeleteConfirm} />
          )}

          {activeSection === 'categories' && (
            <CategoriesSection state={state} onStateChange={onStateChange} onDeleteConfirm={handleDeleteConfirm} />
          )}

          {activeSection === 'locations' && (
            <LocationsSection state={state} onStateChange={onStateChange} onDeleteConfirm={handleDeleteConfirm} />
          )}

          {activeSection === 'users' && isAdmin && <UsersSection />}

          {activeSection === 'data' && (
            <div className="space-y-4">
              <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Icon name="RefreshCw" size={16} className="text-primary" />
                  Синхронизация с сервером
                </h2>
                <p className="text-sm text-muted-foreground">
                  Если данные на этом устройстве отличаются от других — нажми кнопку ниже. Локальный кэш очистится, и все данные загрузятся заново из облака.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    className="justify-start"
                    disabled={syncing}
                    onClick={handleForceSync}
                  >
                    <Icon name={syncing ? 'Loader2' : 'RefreshCw'} size={14} className={`mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Синхронизация…' : 'Синхронизировать с сервером'}
                  </Button>
                </div>
                <div className="p-3 bg-muted/50 border border-border rounded-lg flex items-start gap-2.5">
                  <Icon name="Info" size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    Несохранённые локальные изменения будут заменены данными с сервера. Убедись, что все важные действия уже выполнены.
                  </span>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Icon name="Download" size={16} className="text-primary" />
                  Резервное копирование
                </h2>
                <p className="text-sm text-muted-foreground">
                  Экспортируйте все данные в файл для сохранения резервной копии. Этот файл можно будет загрузить обратно для восстановления.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      const data = JSON.stringify(state, null, 2);
                      const blob = new Blob([data], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      const d = new Date();
                      a.href = url;
                      a.download = `backup_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}-${String(d.getMinutes()).padStart(2,'0')}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Icon name="Download" size={14} className="mr-1.5" />
                    Создать резервную копию
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.json';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          try {
                            const parsed = JSON.parse(ev.target?.result as string);
                            if (!parsed.items || !Array.isArray(parsed.items)) {
                              setImportStatus('error');
                              setTimeout(() => setImportStatus('idle'), 3000);
                              return;
                            }
                            handleDeleteConfirm('текущие данные и заменить их на данные из резервной копии', () => {
                              const restored = guardState(parsed as AppState);
                              onStateChange(restored);
                              saveState(restored);
                              setUserName(restored.currentUser);
                              setThreshold(String(restored.defaultLowStockThreshold));
                              setImportStatus('success');
                              setTimeout(() => setImportStatus('idle'), 3000);
                            });
                          } catch {
                            setImportStatus('error');
                            setTimeout(() => setImportStatus('idle'), 3000);
                          }
                        };
                        reader.readAsText(file);
                      };
                      input.click();
                    }}
                  >
                    <Icon name="Upload" size={14} className="mr-1.5" />
                    Загрузить резервную копию
                  </Button>
                </div>
                {importStatus === 'success' && (
                  <div className="p-3 bg-success/10 border border-success/20 rounded-lg flex items-center gap-2">
                    <Icon name="CheckCircle" size={16} className="text-success shrink-0" />
                    <span className="text-sm text-success font-medium">Данные успешно восстановлены из резервной копии</span>
                  </div>
                )}
                {importStatus === 'error' && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
                    <Icon name="XCircle" size={16} className="text-destructive shrink-0" />
                    <span className="text-sm text-destructive font-medium">Ошибка: файл повреждён или имеет неверный формат</span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Icon name="Info" size={12} />
                  Текущий объём данных: {(JSON.stringify(state).length / 1024).toFixed(1)} КБ · {state.items.length} товаров · {state.workOrders.length} заявок · {state.operations.length} операций
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <Icon name="Trash2" size={16} className="text-destructive" />
                  Очистка данных
                </h2>
                <div className="p-3 bg-destructive/8 border border-destructive/20 rounded-lg flex items-start gap-2.5">
                  <Icon name="AlertTriangle" size={16} className="text-destructive mt-0.5 shrink-0" />
                  <span className="text-sm text-destructive font-medium">Рекомендуем сначала создать резервную копию. Удалённые данные нельзя восстановить.</span>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="justify-start border-warning/40 text-warning hover:bg-warning/10"
                    onClick={() => handleDeleteConfirm('историю, приходы, расходы, документы и остатки (номенклатура сохранится)', () => {
                      const next: AppState = {
                        ...state,
                        operations: [],
                        receipts: [],
                        workOrders: [],
                        techDocs: [],
                        orderCounter: 1,
                        receiptCounter: 1,
                        taskCounter: 1,
                        items: state.items.map(i => ({ ...i, quantity: 0 })),
                        locationStocks: [],
                        warehouseStocks: [],
                      };
                      onStateChange(next);
                      saveState(next);
                    })}
                  >
                    <Icon name="Eraser" size={14} className="mr-1.5" />
                    Очистить историю и остатки
                  </Button>
                  <Button
                    variant="destructive"
                    className="justify-start"
                    onClick={() => handleDeleteConfirm('все данные приложения', () => {
                      const empty = getEmptyState(state.currentUser);
                      empty.darkMode = state.darkMode;
                      onStateChange(empty);
                      saveState(empty);
                      setUserName(empty.currentUser);
                      setThreshold(String(empty.defaultLowStockThreshold));
                    })}
                  >
                    <Icon name="Trash2" size={14} className="mr-1.5" />
                    Очистить все данные
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteConfirm && (
        <Dialog open onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm animate-scale-in">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                  <Icon name="Trash2" size={16} />
                </div>
                Удалить?
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <p className="text-sm text-muted-foreground">
                Удалить <b className="text-foreground">{deleteConfirm.label}</b>? Это действие нельзя отменить.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="flex-1">Отмена</Button>
                <Button onClick={() => { deleteConfirm.onConfirm(); setDeleteConfirm(null); }}
                  className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold">
                  <Icon name="Trash2" size={14} className="mr-1.5" />Удалить
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}