import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'pwa_install_dismissed_at';
const DISMISS_TTL = 1000 * 60 * 60 * 24 * 7;

export default function InstallPWABanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL) return;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
    if (iOS) {
      setIsIOS(true);
      setVisible(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') {
      setVisible(false);
      setDeferred(null);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md animate-slide-up">
      <div className="bg-card border border-border shadow-lg rounded-2xl p-4 flex gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Icon name="Download" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground mb-0.5">
            Установить приложение
          </p>
          <p className="text-xs text-muted-foreground leading-snug mb-2">
            {isIOS
              ? 'Нажмите «Поделиться» в Safari и выберите «На экран «Домой»».'
              : 'Работайте быстрее: иконка на экране, офлайн-режим, полный экран.'}
          </p>
          <div className="flex gap-2">
            {!isIOS && (
              <Button size="sm" onClick={install} className="gap-1.5 h-8 text-xs">
                <Icon name="Download" size={13} />
                Установить
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={dismiss} className="h-8 text-xs">
              Позже
            </Button>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Закрыть"
        >
          <Icon name="X" size={16} />
        </button>
      </div>
    </div>
  );
}
