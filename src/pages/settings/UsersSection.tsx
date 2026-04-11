import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useAuth, AuthUser, apiListUsers, apiRegister, apiChangePassword, apiUpdateUser, apiDeleteUser, UserRole } from '@/data/auth';

export default function UsersSection() {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState<(AuthUser & { isActive?: boolean; createdAt?: string })[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('warehouse');
  const [addUserError, setAddUserError] = useState('');
  const [changePwUserId, setChangePwUserId] = useState<string | null>(null);
  const [newPw, setNewPw] = useState('');

  const loadUsers = async () => {
    const list = await apiListUsers();
    setUsers(list as (AuthUser & { isActive?: boolean; createdAt?: string })[]);
    setUsersLoaded(true);
  };

  return (
    <>
      <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Управление пользователями</h2>
          <Button size="sm" onClick={() => setShowAddUser(true)}>
            <Icon name="UserPlus" size={14} className="mr-1.5" />Добавить
          </Button>
        </div>

        {!usersLoaded ? (
          <Button variant="outline" onClick={loadUsers} className="w-full">
            <Icon name="RefreshCw" size={14} className="mr-1.5" />Загрузить список
          </Button>
        ) : (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                    ${u.role === 'admin' ? 'bg-primary/15 text-primary' : u.role === 'warehouse' ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                    {u.displayName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground flex items-center gap-2">
                      {u.displayName}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                        ${u.role === 'admin' ? 'bg-primary/15 text-primary' : u.role === 'warehouse' ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-muted-foreground/15 text-muted-foreground'}`}>
                        {u.role === 'admin' ? 'Админ' : u.role === 'warehouse' ? 'Кладовщик' : 'Просмотр'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">@{u.username}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {u.id !== authUser?.id && (
                    <>
                      <select value={u.role} onChange={async e => {
                        await apiUpdateUser(u.id, { role: e.target.value as UserRole });
                        loadUsers();
                      }} className="h-7 px-2 text-xs rounded border border-border bg-background text-foreground">
                        <option value="admin">Админ</option>
                        <option value="warehouse">Кладовщик</option>
                        <option value="viewer">Просмотр</option>
                      </select>
                      <button onClick={() => setChangePwUserId(u.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Сменить пароль">
                        <Icon name="KeyRound" size={14} />
                      </button>
                      <button onClick={async () => {
                        if (confirm(`Удалить пользователя ${u.displayName}?`)) {
                          await apiDeleteUser(u.id);
                          loadUsers();
                        }
                      }} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Удалить">
                        <Icon name="Trash2" size={14} />
                      </button>
                    </>
                  )}
                  {u.id === authUser?.id && <span className="text-xs text-muted-foreground italic">Это вы</span>}
                </div>
              </div>
            ))}
            {users.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Нет пользователей</p>}
          </div>
        )}
      </div>

      {showAddUser && (
        <Dialog open onOpenChange={() => setShowAddUser(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Новый пользователь</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label>Логин</Label>
                <Input value={newUsername} onChange={e => { setNewUsername(e.target.value); setAddUserError(''); }} placeholder="ivan" />
              </div>
              <div className="space-y-1">
                <Label>Отображаемое имя</Label>
                <Input value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} placeholder="Иван Петров" />
              </div>
              <div className="space-y-1">
                <Label>Пароль</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Минимум 4 символа" />
              </div>
              <div className="space-y-1">
                <Label>Роль</Label>
                <select value={newRole} onChange={e => setNewRole(e.target.value as UserRole)}
                  className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-card text-foreground">
                  <option value="warehouse">Кладовщик — приход/расход, сборка</option>
                  <option value="viewer">Просмотр — только чтение</option>
                  <option value="admin">Администратор — полный доступ</option>
                </select>
              </div>
              {addUserError && <p className="text-xs text-destructive">{addUserError}</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowAddUser(false)} className="flex-1">Отмена</Button>
                <Button className="flex-1" onClick={async () => {
                  if (!newUsername.trim() || !newPassword.trim()) { setAddUserError('Заполните все поля'); return; }
                  const result = await apiRegister({
                    username: newUsername.trim(),
                    password: newPassword.trim(),
                    displayName: newDisplayName.trim() || newUsername.trim(),
                    role: newRole,
                  });
                  if (result.error) { setAddUserError(result.error); return; }
                  setShowAddUser(false);
                  setNewUsername(''); setNewPassword(''); setNewDisplayName(''); setNewRole('warehouse');
                  loadUsers();
                }}>Создать</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {changePwUserId && (
        <Dialog open onOpenChange={() => setChangePwUserId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Сменить пароль</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label>Новый пароль</Label>
                <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Минимум 4 символа" autoFocus />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setChangePwUserId(null)} className="flex-1">Отмена</Button>
                <Button className="flex-1" onClick={async () => {
                  if (newPw.length < 4) return;
                  await apiChangePassword(changePwUserId, newPw);
                  setChangePwUserId(null);
                  setNewPw('');
                }}>Сохранить</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
