import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/data/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { setError('Введите логин'); return; }
    setLoading(true);
    setError('');
    const err = await login(username.trim(), password);
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <Icon name="Package" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-foreground">StockBase</h1>
          <p className="text-sm text-muted-foreground mt-1">Складской учёт</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-lg">
          <div className="space-y-1.5">
            <Label htmlFor="username">Логин</Label>
            <Input id="username" value={username} onChange={e => { setUsername(e.target.value); setError(''); }}
              placeholder="admin" autoFocus autoComplete="username" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Пароль</Label>
            <Input id="password" type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="••••••••" autoComplete="current-password" />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              <Icon name="AlertCircle" size={14} />
              {error}
            </div>
          )}
          <Button type="submit" className="w-full font-semibold" disabled={loading}>
            {loading ? <Icon name="Loader2" size={16} className="animate-spin mr-2" /> : <Icon name="LogIn" size={16} className="mr-2" />}
            Войти
          </Button>
        </form>
        <div className="text-center text-xs text-muted-foreground mt-4 space-y-0.5">
          <p>Администратор: <span className="font-mono">admin / admin123</span></p>
          <p>Кладовщик: <span className="font-mono">warehouse / warehouse123</span></p>
        </div>
      </div>
    </div>
  );
}