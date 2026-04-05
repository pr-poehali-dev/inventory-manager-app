export type Category = {
  id: string;
  name: string;
  parentId?: string;
  color: string;
};

export type Location = {
  id: string;
  name: string;
  parentId?: string;
  description?: string;
};

export type Item = {
  id: string;
  name: string;
  categoryId: string;
  locationId: string;
  description?: string;
  unit: string;
  quantity: number;
  lowStockThreshold: number;
  imageUrl?: string;
  createdAt: string;
};

export type OperationType = 'in' | 'out';

export type Operation = {
  id: string;
  itemId: string;
  type: OperationType;
  quantity: number;
  comment: string;
  from?: string;
  to?: string;
  performedBy: string;
  date: string;
};

export type AppState = {
  items: Item[];
  categories: Category[];
  locations: Location[];
  operations: Operation[];
  darkMode: boolean;
  defaultLowStockThreshold: number;
  currentUser: string;
};

const initialState: AppState = {
  darkMode: false,
  defaultLowStockThreshold: 5,
  currentUser: 'Администратор',
  categories: [
    { id: 'cat-1', name: 'Электроника', color: '#6366f1' },
    { id: 'cat-2', name: 'Офисные принадлежности', color: '#0ea5e9' },
    { id: 'cat-3', name: 'Инструменты', color: '#f59e0b' },
    { id: 'cat-4', name: 'Расходные материалы', color: '#10b981' },
    { id: 'cat-5', name: 'Упаковка', color: '#8b5cf6' },
  ],
  locations: [
    { id: 'loc-1', name: 'Стеллаж А', description: 'Главный склад, ряд A' },
    { id: 'loc-2', name: 'Стеллаж Б', description: 'Главный склад, ряд Б' },
    { id: 'loc-3', name: 'Стеллаж В', description: 'Дополнительный склад' },
    { id: 'loc-4', name: 'Полка А-1', parentId: 'loc-1', description: 'Стеллаж А, полка 1' },
    { id: 'loc-5', name: 'Полка А-2', parentId: 'loc-1', description: 'Стеллаж А, полка 2' },
    { id: 'loc-6', name: 'Полка Б-1', parentId: 'loc-2', description: 'Стеллаж Б, полка 1' },
  ],
  items: [
    { id: 'item-1', name: 'Ноутбук Lenovo ThinkPad', categoryId: 'cat-1', locationId: 'loc-4', description: 'Рабочие ноутбуки для офиса', unit: 'шт', quantity: 12, lowStockThreshold: 3, imageUrl: '' , createdAt: '2024-01-10' },
    { id: 'item-2', name: 'Бумага A4 (пачка)', categoryId: 'cat-2', locationId: 'loc-5', description: '500 листов, 80г/м²', unit: 'пачка', quantity: 3, lowStockThreshold: 10, imageUrl: '', createdAt: '2024-01-12' },
    { id: 'item-3', name: 'Шуруповёрт Bosch', categoryId: 'cat-3', locationId: 'loc-6', description: 'Аккумуляторный, 18В', unit: 'шт', quantity: 4, lowStockThreshold: 2, imageUrl: '', createdAt: '2024-01-15' },
    { id: 'item-4', name: 'Картридж HP 85A', categoryId: 'cat-4', locationId: 'loc-4', description: 'Картриджи для принтеров HP LaserJet', unit: 'шт', quantity: 2, lowStockThreshold: 5, imageUrl: '', createdAt: '2024-01-18' },
    { id: 'item-5', name: 'Коробка картонная 30x40', categoryId: 'cat-5', locationId: 'loc-5', description: 'Коробки для отгрузки товаров', unit: 'шт', quantity: 87, lowStockThreshold: 20, imageUrl: '', createdAt: '2024-01-20' },
    { id: 'item-6', name: 'Монитор Samsung 27"', categoryId: 'cat-1', locationId: 'loc-4', description: 'IPS, 2560x1440, 75Гц', unit: 'шт', quantity: 6, lowStockThreshold: 2, imageUrl: '', createdAt: '2024-01-22' },
    { id: 'item-7', name: 'Ручки шариковые BIC', categoryId: 'cat-2', locationId: 'loc-6', description: 'Синие, упаковка 50шт', unit: 'упак', quantity: 8, lowStockThreshold: 3, imageUrl: '', createdAt: '2024-01-25' },
    { id: 'item-8', name: 'Скотч упаковочный', categoryId: 'cat-5', locationId: 'loc-5', description: '48мм x 50м, прозрачный', unit: 'рул', quantity: 34, lowStockThreshold: 10, imageUrl: '', createdAt: '2024-01-28' },
  ],
  operations: [
    { id: 'op-1', itemId: 'item-1', type: 'in', quantity: 5, comment: 'Поставка от поставщика', from: 'ООО Техника', to: '', performedBy: 'Администратор', date: '2024-03-01T10:00:00' },
    { id: 'op-2', itemId: 'item-2', type: 'out', quantity: 7, comment: 'Выдано в офис', from: 'Склад', to: 'Офис 201', performedBy: 'Администратор', date: '2024-03-02T14:30:00' },
    { id: 'op-3', itemId: 'item-4', type: 'out', quantity: 3, comment: 'Расходный материал, плановая замена картриджей', from: 'Склад', to: 'IT-отдел', performedBy: 'Администратор', date: '2024-03-03T09:15:00' },
    { id: 'op-4', itemId: 'item-3', type: 'in', quantity: 2, comment: 'Закупка новых инструментов', from: 'OBI', to: 'Склад', performedBy: 'Администратор', date: '2024-03-04T11:00:00' },
    { id: 'op-5', itemId: 'item-5', type: 'in', quantity: 50, comment: 'Плановая закупка упаковки', from: 'Упаковочный завод', to: '', performedBy: 'Администратор', date: '2024-03-05T16:00:00' },
    { id: 'op-6', itemId: 'item-6', type: 'out', quantity: 2, comment: 'Выдано новым сотрудникам', from: 'Склад', to: 'Офис 305', performedBy: 'Администратор', date: '2024-03-06T10:30:00' },
    { id: 'op-7', itemId: 'item-1', type: 'out', quantity: 3, comment: 'Выдано удалённым сотрудникам', from: 'Склад', to: 'Курьер DHL', performedBy: 'Администратор', date: '2024-03-07T13:00:00' },
    { id: 'op-8', itemId: 'item-8', type: 'in', quantity: 20, comment: 'Пополнение запасов', from: 'Поставщик', to: 'Склад', performedBy: 'Администратор', date: '2024-03-08T15:45:00' },
  ],
};

const STORAGE_KEY = 'stockbase_v1';

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch (e) {
    console.warn('Failed to load state', e);
  }
  return initialState;
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}