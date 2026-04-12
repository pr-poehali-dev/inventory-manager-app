import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import { AppState, crudAction } from '@/data/store';

type ProfileProps = {
  state: AppState;
  onStateChange: (s: AppState) => void;
  userName: string;
  setUserName: (v: string) => void;
  saved: boolean;
  onSave: () => void;
};

export function ProfileSection({ state, onStateChange, userName, setUserName, saved, onSave }: ProfileProps) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
      <h2 className="font-semibold text-foreground">Профиль пользователя</h2>
      <div className="space-y-1.5">
        <Label>Имя пользователя</Label>
        <Input value={userName} onChange={e => setUserName(e.target.value)} placeholder="Администратор" />
        <p className="text-xs text-muted-foreground">Отображается в записях операций</p>
      </div>
      <div className="space-y-1.5">
        <Label>Тема оформления</Label>
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Icon name={state.darkMode ? 'Moon' : 'Sun'} size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium">{state.darkMode ? 'Тёмная тема' : 'Светлая тема'}</span>
          </div>
          <Switch
            checked={state.darkMode}
            onCheckedChange={v => {
              const next = { ...state, darkMode: v };
              onStateChange(next);
              crudAction('update_setting', { key: 'darkMode', value: String(!state.darkMode) });
            }}
          />
        </div>
      </div>
      <Button onClick={onSave} className={saved ? 'bg-success hover:bg-success text-success-foreground' : ''}>
        {saved ? <><Icon name="Check" size={15} className="mr-1.5" />Сохранено!</> : 'Сохранить'}
      </Button>
    </div>
  );
}

export type NotificationSettings = {
  lowStock: boolean;
  incoming: boolean;
  outgoing: boolean;
  newItems: boolean;
  assembly: boolean;
  receipts: boolean;
};

const NOTIF_STORAGE_KEY = 'stockbase_notification_settings';

function loadNotifSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (raw) return { ...defaultNotifSettings, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultNotifSettings;
}

const defaultNotifSettings: NotificationSettings = {
  lowStock: true, incoming: true, outgoing: true, newItems: false, assembly: true, receipts: true,
};

type AlertsProps = {
  state: AppState;
  threshold: string;
  setThreshold: (v: string) => void;
  saved: boolean;
  onSave: () => void;
};

export function AlertsSection({ state, threshold, setThreshold, saved, onSave }: AlertsProps) {
  const [notif, setNotif] = useState<NotificationSettings>(loadNotifSettings);

  const updateNotif = (key: keyof NotificationSettings, value: boolean) => {
    const next = { ...notif, [key]: value };
    setNotif(next);
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(next));
  };

  const notifTypes: { key: keyof NotificationSettings; label: string; desc: string; icon: string; color: string }[] = [
    { key: 'lowStock', label: 'Низкий остаток', desc: 'Когда товар достигает порога', icon: 'AlertTriangle', color: 'text-warning' },
    { key: 'incoming', label: 'Приход товара', desc: 'При поступлении на склад', icon: 'ArrowDownToLine', color: 'text-success' },
    { key: 'outgoing', label: 'Расход товара', desc: 'При выдаче со склада', icon: 'ArrowUpFromLine', color: 'text-destructive' },
    { key: 'newItems', label: 'Новые позиции', desc: 'При добавлении в номенклатуру', icon: 'PackagePlus', color: 'text-primary' },
    { key: 'assembly', label: 'Заявки на сборку', desc: 'Создание, завершение, изменения', icon: 'ClipboardList', color: 'text-purple-500' },
    { key: 'receipts', label: 'Поступления', desc: 'Новые приходные накладные', icon: 'FileInput', color: 'text-blue-500' },
  ];

  const lowStockItems = state.items.filter(i => i.quantity <= i.lowStockThreshold);

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
        <h2 className="font-semibold text-foreground">Порог низкого остатка</h2>
        <div className="space-y-1.5">
          <Label>По умолчанию для новых товаров</Label>
          <div className="flex items-center gap-3">
            <Input type="number" min="1" value={threshold} onChange={e => setThreshold(e.target.value)} className="w-28" />
            <span className="text-sm text-muted-foreground">единиц</span>
          </div>
          <p className="text-xs text-muted-foreground">Для каждого товара можно задать индивидуальный порог в карточке.</p>
        </div>
        <Button onClick={onSave} size="sm" className={saved ? 'bg-success hover:bg-success text-success-foreground' : ''}>
          {saved ? <><Icon name="Check" size={14} className="mr-1" />Сохранено!</> : 'Сохранить'}
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
        <h2 className="font-semibold text-foreground">Типы уведомлений</h2>
        <p className="text-xs text-muted-foreground">Включите нужные типы — уведомления будут отображаться в центре уведомлений и отправляться в Telegram (если подключён).</p>
        <div className="space-y-1">
          {notifTypes.map(nt => (
            <div key={nt.key} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg bg-muted flex items-center justify-center ${nt.color}`}>
                  <Icon name={nt.icon} size={16} />
                </div>
                <div>
                  <div className="text-sm font-medium">{nt.label}</div>
                  <div className="text-xs text-muted-foreground">{nt.desc}</div>
                </div>
              </div>
              <Switch checked={notif[nt.key]} onCheckedChange={v => updateNotif(nt.key, v)} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-3">
        <h2 className="font-semibold text-foreground">Сейчас на низком остатке</h2>
        {lowStockItems.length === 0 ? (
          <div className="flex items-center gap-2 p-3 bg-success/8 border border-success/20 rounded-lg text-sm text-success font-medium">
            <Icon name="CheckCircle" size={15} />Все товары в норме
          </div>
        ) : (
          <div className="space-y-1.5">
            {lowStockItems.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-destructive/8 border border-destructive/20 rounded-lg">
                <span className="text-sm font-medium text-foreground">{item.name}</span>
                <span className={`text-sm font-bold tabular-nums ${item.quantity === 0 ? 'text-destructive' : 'text-warning'}`}>
                  {item.quantity} {item.unit}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TelegramSection() {
  const [tgChatId, setTgChatId] = useState(localStorage.getItem('stockbase_tg_chat_id') || '');
  const [tgTesting, setTgTesting] = useState(false);
  const [tgResult, setTgResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const tgApiUrl = (() => {
    const env = import.meta.env.VITE_API_URL;
    if (env === undefined || env === null) return 'https://functions.poehali.dev/ee8097ba-6926-4cdb-ac81-985a17bf68dc';
    if (env === '' || env === '/') return '/api/telegram-notify';
    return `${env}/api/telegram-notify`;
  })();

  const testTelegram = async () => {
    if (!tgChatId.trim()) return;
    setTgTesting(true); setTgResult(null);
    try {
      const res = await fetch(tgApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', chatId: tgChatId.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        localStorage.setItem('stockbase_tg_chat_id', tgChatId.trim());
        setTgResult({ ok: true, msg: 'Сообщение отправлено! Проверьте Telegram.' });
      } else {
        setTgResult({ ok: false, msg: json.error || 'Ошибка отправки' });
      }
    } catch (e) {
      setTgResult({ ok: false, msg: 'Нет связи с сервером. Попробуйте позже.' });
    }
    setTgTesting(false);
  };

  const saveTgChatId = () => {
    localStorage.setItem('stockbase_tg_chat_id', tgChatId.trim());
    setTgResult({ ok: true, msg: 'Chat ID сохранён!' });
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
      <h2 className="font-semibold text-foreground">Уведомления в Telegram</h2>
      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg">
        <div className="flex items-start gap-2">
          <Icon name="Send" size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <span className="font-semibold">Как подключить (2 шага):</span>
            <ol className="mt-1 space-y-1 list-decimal list-inside">
              <li>Откройте Telegram → найдите <b>@userinfobot</b> → отправьте /start → он ответит числом — это ваш <b>Chat ID</b> (например: 123456789)</li>
              <li>Вставьте этот <b>Chat ID</b> (число!) ниже и нажмите «Тест»</li>
            </ol>
            <div className="mt-2 p-2 bg-white/50 dark:bg-black/20 rounded text-xs">
              <b>Важно:</b> сюда нужен Chat ID (число), а НЕ токен бота. Токен бота вставляется в секреты проекта (TELEGRAM_BOT_TOKEN).
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Chat ID</Label>
        <div className="flex items-center gap-2">
          <Input value={tgChatId} onChange={e => { setTgChatId(e.target.value); setTgResult(null); }} placeholder="123456789" className="flex-1" />
          <Button variant="outline" onClick={testTelegram} disabled={tgTesting || !tgChatId.trim()}>
            {tgTesting ? <Icon name="Loader2" size={14} className="animate-spin mr-1.5" /> : <Icon name="Send" size={14} className="mr-1.5" />}
            Тест
          </Button>
        </div>
      </div>
      {tgResult && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${tgResult.ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
          <Icon name={tgResult.ok ? 'CheckCircle' : 'AlertCircle'} size={15} />
          {tgResult.msg}
        </div>
      )}
      <Button onClick={saveTgChatId} disabled={!tgChatId.trim()}>
        <Icon name="Save" size={14} className="mr-1.5" />Сохранить
      </Button>
    </div>
  );
}