import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { AppState, crudAction, getEmptyState, saveState } from '@/data/store';
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
            <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
              <h2 className="font-semibold text-foreground">Управление данными</h2>
              <p className="text-sm text-muted-foreground">
                Полная очистка удалит все товары, операции, заявки, приходы, категории, склады и локации. Пользователь и настройки темы сохранятся.
              </p>
              <div className="p-3 bg-destructive/8 border border-destructive/20 rounded-lg flex items-start gap-2.5">
                <Icon name="AlertTriangle" size={16} className="text-destructive mt-0.5 shrink-0" />
                <span className="text-sm text-destructive font-medium">Это действие нельзя отменить. Все данные будут удалены безвозвратно.</span>
              </div>
              <Button
                variant="destructive"
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