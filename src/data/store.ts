// ─── Base Types ───────────────────────────────────────────────────────────────

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
  warehouseId?: string;   // к какому складу принадлежит стеллаж/полка
};

export type Attachment = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  dataUrl: string;
  uploadedAt: string;
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
  attachments?: Attachment[];
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
  orderId?: string;
  locationId?: string;
  warehouseId?: string;       // склад операции
  scannedCodes?: string[];    // отсканированные штрих-коды в этой операции
};

// ─── Warehouses (Склады) ──────────────────────────────────────────────────────

export type Warehouse = {
  id: string;
  name: string;
  address?: string;
  description?: string;
  createdAt: string;
};

// ─── Barcodes / QR-codes ──────────────────────────────────────────────────────

export type Barcode = {
  id: string;
  itemId: string;
  code: string;           // сам код (строка)
  format?: string;        // EAN13, QR_CODE, CODE128, etc.
  label?: string;         // человекочитаемая метка
  createdAt: string;
};

// ─── Location Stocks ──────────────────────────────────────────────────────────

export type LocationStock = {
  itemId: string;
  locationId: string;
  quantity: number;
};

// ─── Warehouse Stocks ─────────────────────────────────────────────────────────

export type WarehouseStock = {
  itemId: string;
  warehouseId: string;
  quantity: number;
};

// ─── Partners (Suppliers & Recipients) ───────────────────────────────────────

export type PartnerType = 'supplier' | 'recipient';

export type Partner = {
  id: string;
  name: string;
  type: PartnerType;
  contact?: string;
  note?: string;
  createdAt: string;
};

// ─── Work Orders ──────────────────────────────────────────────────────────────

export type OrderStatus = 'draft' | 'active' | 'assembled' | 'closed' | 'pending_stock';

export type OrderItemStatus = 'pending' | 'partial' | 'done';

export type OrderItem = {
  id: string;
  itemId: string;
  requiredQty: number;
  pickedQty: number;
  status: OrderItemStatus;
};

export type WorkOrder = {
  id: string;
  number: string;
  title: string;
  status: OrderStatus;
  createdBy: string;
  recipientId?: string;
  recipientName?: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  comment?: string;
};

// ─── Receipts (Оприходование) ─────────────────────────────────────────────────

export type ReceiptStatus =
  | 'draft'            // Черновик
  | 'pending'          // Заявка на сборку (этап 1 завершён, ждёт подтверждения)
  | 'confirming'       // В процессе подтверждения (этап 2 начат)
  | 'posted';          // Оприходовано (товары на складе)

export type ReceiptLine = {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;             // плановое кол-во (из заявки)
  confirmedQty: number;    // фактически принятое кол-во (после сканирования)
  locationId: string;
  price?: number;
  unit: string;
  isNew?: boolean;
};

export type ScanEvent = {
  id: string;
  code: string;
  itemId: string;
  lineId: string;
  scannedAt: string;
  scannedBy: string;
  method: 'camera' | 'manual';
};

export type ReceiptCustomField = {
  key: string;
  value: string;
};

export type Receipt = {
  id: string;
  number: string;
  status: ReceiptStatus;
  supplierId?: string;
  supplierName: string;
  warehouseId?: string;
  date: string;
  createdBy: string;
  lines: ReceiptLine[];
  customFields: ReceiptCustomField[];
  comment?: string;
  totalAmount?: number;
  scanHistory: ScanEvent[];
  postedAt?: string;
  photoUrl?: string;
  attachments?: Attachment[];
};

export type InvoiceTemplate = {
  id: string;
  name: string;
  companyName: string;
  companyAddress?: string;
  companyInn?: string;
  companyKpp?: string;
  bankDetails?: string;
  headerText?: string;
  footerText?: string;
  signatory?: string;
  signatoryRole?: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
};

// ─── Technician Documents (база данных документов и вложений) ─────────────────

export type DocCustomField = {
  key: string;
  value: string;
};

export type DocEntry = {
  id: string;
  // Привязка к номенклатуре (обязательно)
  itemId: string;
  // Доп. поля
  docNumber?: string;       // номер документа / накладной
  docDate?: string;         // дата документа
  docType: string;          // тип: 'Накладная' | 'Акт' | 'Паспорт' | 'Инструкция' | ...
  supplier?: string;        // поставщик/источник
  notes?: string;           // примечание
  customFields: DocCustomField[];
  attachments: Attachment[];
  coverUrl?: string;        // главное фото — фон карточки
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

// ─── App State ────────────────────────────────────────────────────────────────

export type AppState = {
  items: Item[];
  categories: Category[];
  locations: Location[];
  operations: Operation[];
  locationStocks: LocationStock[];
  workOrders: WorkOrder[];
  partners: Partner[];
  receipts: Receipt[];
  techDocs: DocEntry[];
  warehouses: Warehouse[];
  warehouseStocks: WarehouseStock[];
  barcodes: Barcode[];
  invoiceTemplates: InvoiceTemplate[];
  darkMode: boolean;
  defaultLowStockThreshold: number;
  currentUser: string;
  orderCounter: number;
  receiptCounter: number;
  taskCounter: number;
};

// ─── Initial Data ─────────────────────────────────────────────────────────────

const initialState: AppState = {
  darkMode: false,
  defaultLowStockThreshold: 5,
  currentUser: 'Администратор',
  orderCounter: 3,
  receiptCounter: 1,
  taskCounter: 1,
  receipts: [],
  techDocs: [],
  barcodes: [],
  invoiceTemplates: [],
  warehouses: [
    { id: 'wh-1', name: 'Главный склад', address: 'ул. Складская, 1', description: 'Основной склад хранения', createdAt: '2024-01-01' },
    { id: 'wh-2', name: 'Склад №2', address: 'ул. Промышленная, 5', description: 'Дополнительный склад', createdAt: '2024-01-01' },
  ],
  warehouseStocks: [
    { itemId: 'item-1', warehouseId: 'wh-1', quantity: 8 },
    { itemId: 'item-1', warehouseId: 'wh-2', quantity: 4 },
    { itemId: 'item-2', warehouseId: 'wh-1', quantity: 3 },
    { itemId: 'item-3', warehouseId: 'wh-1', quantity: 4 },
    { itemId: 'item-4', warehouseId: 'wh-1', quantity: 2 },
    { itemId: 'item-5', warehouseId: 'wh-1', quantity: 60 },
    { itemId: 'item-5', warehouseId: 'wh-2', quantity: 27 },
    { itemId: 'item-6', warehouseId: 'wh-1', quantity: 6 },
    { itemId: 'item-7', warehouseId: 'wh-1', quantity: 8 },
    { itemId: 'item-8', warehouseId: 'wh-1', quantity: 20 },
    { itemId: 'item-8', warehouseId: 'wh-2', quantity: 14 },
  ],
  categories: [
    { id: 'cat-1', name: 'Электроника', color: '#6366f1' },
    { id: 'cat-2', name: 'Офисные принадлежности', color: '#0ea5e9' },
    { id: 'cat-3', name: 'Инструменты', color: '#f59e0b' },
    { id: 'cat-4', name: 'Расходные материалы', color: '#10b981' },
    { id: 'cat-5', name: 'Упаковка', color: '#8b5cf6' },
  ],
  locations: [
    { id: 'loc-1', name: 'Стеллаж А', description: 'Главный склад, ряд A', warehouseId: 'wh-1' },
    { id: 'loc-2', name: 'Стеллаж Б', description: 'Главный склад, ряд Б', warehouseId: 'wh-1' },
    { id: 'loc-3', name: 'Стеллаж В', description: 'Дополнительный склад', warehouseId: 'wh-2' },
    { id: 'loc-4', name: 'Полка А-1', parentId: 'loc-1', description: 'Стеллаж А, полка 1', warehouseId: 'wh-1' },
    { id: 'loc-5', name: 'Полка А-2', parentId: 'loc-1', description: 'Стеллаж А, полка 2', warehouseId: 'wh-1' },
    { id: 'loc-6', name: 'Полка Б-1', parentId: 'loc-2', description: 'Стеллаж Б, полка 1', warehouseId: 'wh-1' },
  ],
  items: [
    { id: 'item-1', name: 'Ноутбук Lenovo ThinkPad', categoryId: 'cat-1', locationId: 'loc-4', description: 'Рабочие ноутбуки для офиса', unit: 'шт', quantity: 12, lowStockThreshold: 3, imageUrl: '', createdAt: '2024-01-10' },
    { id: 'item-2', name: 'Бумага A4 (пачка)', categoryId: 'cat-2', locationId: 'loc-5', description: '500 листов, 80г/м²', unit: 'пачка', quantity: 3, lowStockThreshold: 10, imageUrl: '', createdAt: '2024-01-12' },
    { id: 'item-3', name: 'Шуруповёрт Bosch', categoryId: 'cat-3', locationId: 'loc-6', description: 'Аккумуляторный, 18В', unit: 'шт', quantity: 4, lowStockThreshold: 2, imageUrl: '', createdAt: '2024-01-15' },
    { id: 'item-4', name: 'Картридж HP 85A', categoryId: 'cat-4', locationId: 'loc-4', description: 'Картриджи для принтеров HP LaserJet', unit: 'шт', quantity: 2, lowStockThreshold: 5, imageUrl: '', createdAt: '2024-01-18' },
    { id: 'item-5', name: 'Коробка картонная 30x40', categoryId: 'cat-5', locationId: 'loc-5', description: 'Коробки для отгрузки товаров', unit: 'шт', quantity: 87, lowStockThreshold: 20, imageUrl: '', createdAt: '2024-01-20' },
    { id: 'item-6', name: 'Монитор Samsung 27"', categoryId: 'cat-1', locationId: 'loc-4', description: 'IPS, 2560x1440, 75Гц', unit: 'шт', quantity: 6, lowStockThreshold: 2, imageUrl: '', createdAt: '2024-01-22' },
    { id: 'item-7', name: 'Ручки шариковые BIC', categoryId: 'cat-2', locationId: 'loc-6', description: 'Синие, упаковка 50шт', unit: 'упак', quantity: 8, lowStockThreshold: 3, imageUrl: '', createdAt: '2024-01-25' },
    { id: 'item-8', name: 'Скотч упаковочный', categoryId: 'cat-5', locationId: 'loc-5', description: '48мм x 50м, прозрачный', unit: 'рул', quantity: 34, lowStockThreshold: 10, imageUrl: '', createdAt: '2024-01-28' },
  ],
  locationStocks: [
    { itemId: 'item-1', locationId: 'loc-4', quantity: 8 },
    { itemId: 'item-1', locationId: 'loc-5', quantity: 4 },
    { itemId: 'item-2', locationId: 'loc-5', quantity: 3 },
    { itemId: 'item-3', locationId: 'loc-6', quantity: 4 },
    { itemId: 'item-4', locationId: 'loc-4', quantity: 2 },
    { itemId: 'item-5', locationId: 'loc-5', quantity: 60 },
    { itemId: 'item-5', locationId: 'loc-3', quantity: 27 },
    { itemId: 'item-6', locationId: 'loc-4', quantity: 6 },
    { itemId: 'item-7', locationId: 'loc-6', quantity: 8 },
    { itemId: 'item-8', locationId: 'loc-5', quantity: 20 },
    { itemId: 'item-8', locationId: 'loc-3', quantity: 14 },
  ],
  partners: [
    { id: 'p-1', name: 'ООО Техника', type: 'supplier', contact: '+7 495 000-01-01', note: 'Поставщик электроники', createdAt: '2024-01-01' },
    { id: 'p-2', name: 'Упаковочный завод', type: 'supplier', contact: '', note: 'Коробки и скотч', createdAt: '2024-01-05' },
    { id: 'p-3', name: 'OBI', type: 'supplier', contact: '', note: 'Инструменты', createdAt: '2024-01-08' },
    { id: 'p-4', name: 'Офис 201', type: 'recipient', contact: '', note: 'Бухгалтерия', createdAt: '2024-01-10' },
    { id: 'p-5', name: 'IT-отдел', type: 'recipient', contact: 'Петров А.', note: '', createdAt: '2024-01-10' },
    { id: 'p-6', name: 'Офис 305', type: 'recipient', contact: '', note: 'Отдел продаж', createdAt: '2024-01-12' },
  ],
  workOrders: [
    {
      id: 'order-1',
      number: 'ЗС-001',
      title: 'Комплектация рабочих мест новых сотрудников',
      status: 'active',
      createdBy: 'Администратор',
      recipientId: 'p-5',
      recipientName: 'IT-отдел',
      createdAt: '2024-03-10T09:00:00',
      updatedAt: '2024-03-10T09:00:00',
      comment: 'Срочно! 3 рабочих места до 15 марта',
      items: [
        { id: 'oi-1', itemId: 'item-1', requiredQty: 3, pickedQty: 1, status: 'partial' },
        { id: 'oi-2', itemId: 'item-6', requiredQty: 3, pickedQty: 3, status: 'done' },
        { id: 'oi-3', itemId: 'item-7', requiredQty: 2, pickedQty: 0, status: 'pending' },
      ],
    },
    {
      id: 'order-2',
      number: 'ЗС-002',
      title: 'Отправка упаковочного материала на склад Б',
      status: 'draft',
      createdBy: 'Администратор',
      createdAt: '2024-03-12T11:00:00',
      updatedAt: '2024-03-12T11:00:00',
      items: [
        { id: 'oi-4', itemId: 'item-5', requiredQty: 20, pickedQty: 0, status: 'pending' },
        { id: 'oi-5', itemId: 'item-8', requiredQty: 10, pickedQty: 0, status: 'pending' },
      ],
    },
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

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'stockbase_v3';

/** Локальный режим — облако отключено, все данные в localStorage. */
export async function checkServerUpdatedAt(): Promise<string | null> {
  return null;
}

export async function loadStateFromServer(): Promise<{ state: AppState; updatedAt: string } | null> {
  return null;
}

export async function saveStateToServer(_state: AppState): Promise<string | null> {
  return new Date().toISOString();
}

export async function crudAction(_action: string, _payload: Record<string, unknown>): Promise<boolean> {
  return true;
}

/** Применить guard-проверки к загруженному состоянию. */
function guardState(p: AppState): AppState {
  if (!Array.isArray(p.items))          p.items = initialState.items;
  if (!Array.isArray(p.categories))     p.categories = initialState.categories;
  if (!Array.isArray(p.locations))      p.locations = initialState.locations;
  if (!Array.isArray(p.operations))     p.operations = [];
  if (!Array.isArray(p.locationStocks)) p.locationStocks = initialState.locationStocks;
  if (!Array.isArray(p.workOrders))     p.workOrders = [];
  if (!Array.isArray(p.partners))       p.partners = initialState.partners;
  if (!Array.isArray(p.receipts))       p.receipts = [];
  if (p.orderCounter === undefined)     p.orderCounter = initialState.orderCounter;
  if (p.receiptCounter === undefined)   p.receiptCounter = 1;
  if (!Array.isArray(p.techDocs))       p.techDocs = [];
  if (p.taskCounter === undefined)      p.taskCounter = 1;
  if (!p.currentUser)                   p.currentUser = initialState.currentUser;
  if (p.defaultLowStockThreshold === undefined) p.defaultLowStockThreshold = initialState.defaultLowStockThreshold;
  if (typeof p.darkMode !== 'boolean')  p.darkMode = false;
  if (!Array.isArray(p.warehouses))     p.warehouses = initialState.warehouses;
  if (!Array.isArray(p.warehouseStocks)) p.warehouseStocks = initialState.warehouseStocks;
  if (!Array.isArray(p.barcodes))       p.barcodes = [];
  if (!Array.isArray(p.invoiceTemplates)) p.invoiceTemplates = [];
  if (Array.isArray(p.locations) && Array.isArray(p.warehouses) && p.warehouses.length > 0) {
    const defaultWhId = p.warehouses[0].id;
    p.locations = p.locations.map(l => l.warehouseId ? l : { ...l, warehouseId: defaultWhId });
  }
  if (Array.isArray(p.receipts)) {
    p.receipts = p.receipts.map(r => ({
      ...r,
      status: r.status || 'posted',
      scanHistory: r.scanHistory || [],
      lines: (r.lines || []).map((l: ReceiptLine) => ({
        ...l,
        confirmedQty: l.confirmedQty !== undefined ? l.confirmedQty : l.qty,
      })),
    }));
  }
  if (Array.isArray(p.warehouseStocks) && p.warehouseStocks.length > 0 && Array.isArray(p.items)) {
    p.items = p.items.map(item => {
      const whTotal = p.warehouseStocks
        .filter(ws => ws.itemId === item.id)
        .reduce((s, ws) => s + ws.quantity, 0);
      if (whTotal > 0 && item.quantity !== whTotal) {
        return { ...item, quantity: whTotal };
      }
      return item;
    });
  }
  return p;
}

export function getEmptyState(preserveUser?: string): AppState {
  return {
    darkMode: false,
    defaultLowStockThreshold: 5,
    currentUser: preserveUser || 'Администратор',
    orderCounter: 1,
    receiptCounter: 1,
    taskCounter: 1,
    items: [],
    categories: [],
    locations: [],
    operations: [],
    locationStocks: [],
    workOrders: [],
    partners: [],
    receipts: [],
    techDocs: [],
    warehouses: [],
    warehouseStocks: [],
    barcodes: [],
    invoiceTemplates: [],
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return guardState(JSON.parse(raw) as AppState);
  } catch (e) {
    console.warn('Failed to load state, using defaults:', e);
  }
  return initialState;
}

/** Сохранить только в localStorage (без пуша на сервер — для polling). */
export function saveLocal(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save state (storage may be full):', e);
  }
}

export function saveState(state: AppState): void {
  const stamped = { ...state, _savedAt: new Date().toISOString() };
  saveLocal(stamped);
  saveStateToServer(state);
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getLocationStock(state: AppState, itemId: string, locationId: string): number {
  return state.locationStocks.find(ls => ls.itemId === itemId && ls.locationId === locationId)?.quantity ?? 0;
}

export function updateLocationStock(state: AppState, itemId: string, locationId: string, delta: number): AppState {
  const existing = state.locationStocks.find(ls => ls.itemId === itemId && ls.locationId === locationId);
  let next: LocationStock[];
  if (existing) {
    next = state.locationStocks.map(ls =>
      ls.itemId === itemId && ls.locationId === locationId
        ? { ...ls, quantity: Math.max(0, ls.quantity + delta) }
        : ls
    );
  } else if (delta > 0) {
    next = [...state.locationStocks, { itemId, locationId, quantity: delta }];
  } else {
    next = state.locationStocks;
  }
  return { ...state, locationStocks: next };
}

export function getWarehouseStock(state: AppState, itemId: string, warehouseId: string): number {
  return (state.warehouseStocks || []).find(ws => ws.itemId === itemId && ws.warehouseId === warehouseId)?.quantity ?? 0;
}

export function updateWarehouseStock(state: AppState, itemId: string, warehouseId: string, delta: number): AppState {
  const stocks = state.warehouseStocks || [];
  const existing = stocks.find(ws => ws.itemId === itemId && ws.warehouseId === warehouseId);
  let next: WarehouseStock[];
  if (existing) {
    next = stocks.map(ws =>
      ws.itemId === itemId && ws.warehouseId === warehouseId
        ? { ...ws, quantity: Math.max(0, ws.quantity + delta) }
        : ws
    );
  } else if (delta > 0) {
    next = [...stocks, { itemId, warehouseId, quantity: delta }];
  } else {
    next = stocks;
  }
  // Also update item.quantity = sum across all warehouses
  const totalQty = next
    .filter(ws => ws.itemId === itemId)
    .reduce((s, ws) => s + ws.quantity, 0);
  const updatedItems = state.items.map(it => it.id === itemId ? { ...it, quantity: totalQty } : it);
  return { ...state, warehouseStocks: next, items: updatedItems };
}

export function revertPostedReceipt(state: AppState, receipt: Receipt): AppState {
  if (receipt.status !== 'posted') return state;
  let next = { ...state };
  const receiptComment = `[Оприходование ${receipt.number}]`;

  for (const line of receipt.lines) {
    const qty = line.confirmedQty || line.qty;
    if (qty <= 0) continue;

    if (receipt.warehouseId) {
      next = updateWarehouseStock(next, line.itemId, receipt.warehouseId, -qty);
    } else {
      next = {
        ...next,
        items: next.items.map(i => i.id === line.itemId ? { ...i, quantity: Math.max(0, i.quantity - qty) } : i),
      };
    }

    if (line.locationId) {
      next = updateLocationStock(next, line.itemId, line.locationId, -qty);
    }
  }

  next = {
    ...next,
    operations: next.operations.filter(op => op.comment !== receiptComment),
  };

  return next;
}

export function recalcStocksFromOperations(state: AppState): AppState {
  const freshWarehouseStocks: WarehouseStock[] = [];
  const freshLocationStocks: LocationStock[] = [];
  const itemQuantities: Record<string, number> = {};

  for (const item of state.items) {
    itemQuantities[item.id] = 0;
  }

  for (const op of state.operations) {
    const delta = op.type === 'in' ? op.quantity : -op.quantity;

    if (op.warehouseId) {
      const existing = freshWarehouseStocks.find(ws => ws.itemId === op.itemId && ws.warehouseId === op.warehouseId);
      if (existing) {
        existing.quantity = Math.max(0, existing.quantity + delta);
      } else if (delta > 0) {
        freshWarehouseStocks.push({ itemId: op.itemId, warehouseId: op.warehouseId, quantity: delta });
      }
    }

    if (op.locationId) {
      const existing = freshLocationStocks.find(ls => ls.itemId === op.itemId && ls.locationId === op.locationId);
      if (existing) {
        existing.quantity = Math.max(0, existing.quantity + delta);
      } else if (delta > 0) {
        freshLocationStocks.push({ itemId: op.itemId, locationId: op.locationId, quantity: delta });
      }
    }

    if (op.itemId in itemQuantities) {
      itemQuantities[op.itemId] = Math.max(0, (itemQuantities[op.itemId] || 0) + delta);
    }
  }

  const updatedItems = state.items.map(item => {
    const wsTotal = freshWarehouseStocks
      .filter(ws => ws.itemId === item.id)
      .reduce((s, ws) => s + ws.quantity, 0);
    const quantity = wsTotal > 0 ? wsTotal : (itemQuantities[item.id] ?? item.quantity);
    return { ...item, quantity };
  });

  return {
    ...state,
    items: updatedItems,
    warehouseStocks: freshWarehouseStocks,
    locationStocks: freshLocationStocks,
  };
}

export function getItemBarcodes(state: AppState, itemId: string): Barcode[] {
  return (state.barcodes || []).filter(b => b.itemId === itemId);
}

export function findItemByBarcode(state: AppState, code: string): Item | undefined {
  const barcode = (state.barcodes || []).find(b => b.code === code);
  if (!barcode) return undefined;
  return state.items.find(it => it.id === barcode.itemId);
}

export function getOrderStatusLabel(status: OrderStatus): string {
  const m: Record<OrderStatus, string> = {
    draft: 'Черновик', active: 'В работе',
    assembled: 'Собрана', closed: 'Закрыта', pending_stock: 'Ожидает поставки',
  };
  return m[status];
}

export function getOrderStatusColor(status: OrderStatus): string {
  const m: Record<OrderStatus, string> = {
    draft: 'text-muted-foreground bg-muted',
    active: 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-950',
    assembled: 'text-success bg-success/12',
    closed: 'text-muted-foreground bg-muted/60',
    pending_stock: 'text-warning bg-warning/12',
  };
  return m[status];
}

/** Сколько единиц item зарезервировано активными заявками (кроме excludeOrderId) */
export function getReservedQty(state: AppState, itemId: string, excludeOrderId?: string): number {
  return state.workOrders
    .filter(o => ['active', 'draft', 'pending_stock'].includes(o.status) && o.id !== excludeOrderId)
    .flatMap(o => o.items)
    .filter(oi => oi.itemId === itemId)
    .reduce((sum, oi) => sum + (oi.requiredQty - oi.pickedQty), 0);
}

/** Свободный остаток с учётом резервов */
export function getFreeQty(state: AppState, itemId: string, excludeOrderId?: string): number {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return 0;
  return item.quantity - getReservedQty(state, itemId, excludeOrderId);
}