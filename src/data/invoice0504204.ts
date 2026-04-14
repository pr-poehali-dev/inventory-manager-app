import { InvoiceTemplate, InvElement, generateId } from './store';

export function create0504204Template(): InvoiceTemplate {
  const id = generateId();
  const now = new Date().toISOString();
  const e = (overrides: Partial<InvElement> & { type: InvElement['type']; x: number; y: number; w: number; h: number }): InvElement => ({
    id: generateId(), fontSize: 10, bold: false, italic: false, align: 'left', ...overrides
  });

  const elements: InvElement[] = [
    e({ type: 'text', x: 200, y: 20, w: 500, h: 20, text: 'ТРЕБОВАНИЕ-НАКЛАДНАЯ №', fontSize: 14, bold: true, align: 'center' }),
    e({ type: 'text', x: 700, y: 20, w: 100, h: 20, text: '', fontSize: 14, bold: true, align: 'center', source: '{{number}}' }),

    e({ type: 'text', x: 350, y: 46, w: 40, h: 16, text: 'от', fontSize: 10, align: 'center' }),
    e({ type: 'text', x: 390, y: 46, w: 200, h: 16, text: '', fontSize: 10, align: 'center', source: '{{date}}' }),
    e({ type: 'line', x: 390, y: 62, w: 200, h: 1, lineStyle: 'solid', lineWidth: 1 }),

    e({ type: 'frame', x: 780, y: 10, w: 200, h: 116, lineStyle: 'solid', frameLabel: 'Коды' }),
    e({ type: 'text', x: 785, y: 38, w: 110, h: 14, text: 'Форма по ОКУД', fontSize: 8, align: 'right' }),
    e({ type: 'text', x: 900, y: 38, w: 70, h: 14, text: '0504204', fontSize: 8, align: 'center' }),
    e({ type: 'line', x: 895, y: 36, w: 1, h: 90, lineStyle: 'solid', lineWidth: 1, vertical: true }),
    e({ type: 'text', x: 785, y: 56, w: 110, h: 14, text: 'Дата', fontSize: 8, align: 'right' }),
    e({ type: 'text', x: 900, y: 56, w: 70, h: 14, text: '', fontSize: 8, align: 'center' }),
    e({ type: 'text', x: 785, y: 74, w: 110, h: 14, text: 'по ОКПО', fontSize: 8, align: 'right' }),
    e({ type: 'text', x: 900, y: 74, w: 70, h: 14, text: '', fontSize: 8, align: 'center' }),
    e({ type: 'line', x: 895, y: 52, w: 80, h: 1, lineStyle: 'solid', lineWidth: 1 }),
    e({ type: 'line', x: 895, y: 70, w: 80, h: 1, lineStyle: 'solid', lineWidth: 1 }),
    e({ type: 'line', x: 895, y: 88, w: 80, h: 1, lineStyle: 'solid', lineWidth: 1 }),

    e({ type: 'text', x: 785, y: 104, w: 110, h: 14, text: 'по ОКЕИ', fontSize: 8, align: 'right' }),
    e({ type: 'text', x: 900, y: 104, w: 70, h: 14, text: '383', fontSize: 8, align: 'center' }),
    e({ type: 'line', x: 895, y: 118, w: 80, h: 1, lineStyle: 'solid', lineWidth: 1 }),

    e({ type: 'text', x: 30, y: 78, w: 100, h: 14, text: 'Учреждение', fontSize: 9 }),
    e({ type: 'text', x: 130, y: 78, w: 300, h: 14, text: '', fontSize: 9, source: '{{institution}}' }),
    e({ type: 'line', x: 130, y: 92, w: 620, h: 1, lineStyle: 'solid', lineWidth: 1 }),

    e({ type: 'text', x: 30, y: 98, w: 280, h: 14, text: 'Структурное подразделение - отправитель', fontSize: 9 }),
    e({ type: 'text', x: 310, y: 98, w: 300, h: 14, text: '', fontSize: 9 }),
    e({ type: 'line', x: 310, y: 112, w: 440, h: 1, lineStyle: 'solid', lineWidth: 1 }),

    e({ type: 'text', x: 30, y: 118, w: 280, h: 14, text: 'Структурное подразделение - получатель', fontSize: 9 }),
    e({ type: 'text', x: 310, y: 118, w: 300, h: 14, text: '', fontSize: 9, source: '{{recipient}}' }),
    e({ type: 'line', x: 310, y: 132, w: 440, h: 1, lineStyle: 'solid', lineWidth: 1 }),

    e({ type: 'text', x: 30, y: 140, w: 500, h: 14, text: 'Единица измерения: руб. (с точностью до второго десятичного знака)', fontSize: 9 }),

    e({ type: 'text', x: 30, y: 168, w: 80, h: 14, text: 'Затребовал', fontSize: 9, bold: true }),
    e({ type: 'text', x: 115, y: 168, w: 100, h: 14, text: '', fontSize: 9, align: 'center' }),
    e({ type: 'line', x: 115, y: 182, w: 100, h: 1, lineStyle: 'solid', lineWidth: 1 }),
    e({ type: 'text', x: 115, y: 183, w: 100, h: 10, text: '(звание)', fontSize: 7, align: 'center', italic: true }),
    e({ type: 'text', x: 225, y: 168, w: 140, h: 14, text: '', fontSize: 9, align: 'center' }),
    e({ type: 'line', x: 225, y: 182, w: 140, h: 1, lineStyle: 'solid', lineWidth: 1 }),
    e({ type: 'text', x: 225, y: 183, w: 140, h: 10, text: '(фамилия, инициалы)', fontSize: 7, align: 'center', italic: true }),

    e({ type: 'text', x: 420, y: 168, w: 70, h: 14, text: 'Разрешил', fontSize: 9, bold: true }),
    e({ type: 'text', x: 495, y: 168, w: 100, h: 14, text: '', fontSize: 9, align: 'center', source: '{{signatoryRole}}' }),
    e({ type: 'line', x: 495, y: 182, w: 100, h: 1, lineStyle: 'solid', lineWidth: 1 }),
    e({ type: 'text', x: 495, y: 183, w: 100, h: 10, text: '(должность)', fontSize: 7, align: 'center', italic: true }),
    e({ type: 'text', x: 605, y: 168, w: 90, h: 14, text: '', fontSize: 9, align: 'center' }),
    e({ type: 'line', x: 605, y: 182, w: 90, h: 1, lineStyle: 'solid', lineWidth: 1 }),
    e({ type: 'text', x: 605, y: 183, w: 90, h: 10, text: '(подпись)', fontSize: 7, align: 'center', italic: true }),
    e({ type: 'text', x: 705, y: 168, w: 140, h: 14, text: '', fontSize: 9, align: 'center', source: '{{signatory}}' }),
    e({ type: 'line', x: 705, y: 182, w: 140, h: 1, lineStyle: 'solid', lineWidth: 1 }),
    e({ type: 'text', x: 705, y: 183, w: 140, h: 10, text: '(расшифровка подписи)', fontSize: 7, align: 'center', italic: true }),

    e({ type: 'table', x: 30, y: 202, w: 940, h: 200, columns: [
      { key: generateId(), label: 'Наименование', width: 160, source: '{{item.name}}' },
      { key: generateId(), label: 'Номенкл. номер', width: 60, source: '{{item.nomenNum}}' },
      { key: generateId(), label: 'Паспорта (иной)', width: 70, source: '' },
      { key: generateId(), label: 'Ед. изм.', width: 50, source: '{{item.unit}}' },
      { key: generateId(), label: 'Код ОКЕИ', width: 45, source: '' },
      { key: generateId(), label: 'Цена', width: 50, source: '{{item.price}}' },
      { key: generateId(), label: 'Затребовано', width: 65, source: '{{item.qtyReq}}' },
      { key: generateId(), label: 'Отпущено', width: 65, source: '{{item.qtyRel}}' },
      { key: generateId(), label: 'Сумма (без НДС)', width: 65, source: '{{item.sum}}' },
      { key: generateId(), label: 'Дебет', width: 50, source: '{{item.debit}}' },
      { key: generateId(), label: 'Кредит', width: 50, source: '{{item.credit}}' },
      { key: generateId(), label: 'Примечание', width: 70, source: '{{item.note}}' },
    ] }),

    e({ type: 'text', x: 30, y: 440, w: 70, h: 16, text: 'Отпустил', fontSize: 10, bold: true }),
    e({ type: 'text', x: 40, y: 462, w: 100, h: 14, text: '', fontSize: 9, align: 'center' }),
    e({ type: 'line', x: 40, y: 476, w: 100, h: 1, lineStyle: 'solid', lineWidth: 1 }),
    e({ type: 'text', x: 40, y: 477, w: 100, h: 10, text: '(звание)', fontSize: 7, align: 'center', italic: true }),
    e({ type: 'text', x: 150, y: 462, w: 100, h: 14, text: '', fontSize: 9, align: 'center' }),
    e({ type: 'line', x: 150, y: 476, w: 100, h: 1, lineStyle: 'solid', lineWidth: 1 }),
    e({ type: 'text', x: 150, y: 477, w: 100, h: 10, text: '(подпись)', fontSize: 7, align: 'center', italic: true }),
    e({ type: 'text', x: 260, y: 462, w: 140, h: 14, text: '', fontSize: 9, align: 'center' }),
    e({ type: 'line', x: 260, y: 476, w: 140, h: 1, lineStyle: 'solid', lineWidth: 1 }),
    e({ type: 'text', x: 260, y: 477, w: 140, h: 10, text: '(расшифровка подписи)', fontSize: 7, align: 'center', italic: true }),
    e({ type: 'text', x: 40, y: 494, w: 150, h: 14, text: '', fontSize: 9, source: '{{date}}' }),

    e({ type: 'text', x: 440, y: 440, w: 200, h: 16, text: 'Ответственный исполнитель', fontSize: 10, bold: true }),
    e({ type: 'text', x: 450, y: 462, w: 100, h: 14, text: '', fontSize: 9, align: 'center' }),
    e({ type: 'line', x: 450, y: 476, w: 100, h: 1, lineStyle: 'solid', lineWidth: 1 }),
    e({ type: 'text', x: 450, y: 477, w: 100, h: 10, text: '(должность)', fontSize: 7, align: 'center', italic: true }),
    e({ type: 'text', x: 560, y: 462, w: 100, h: 14, text: '', fontSize: 9, align: 'center' }),
    e({ type: 'line', x: 560, y: 476, w: 100, h: 1, lineStyle: 'solid', lineWidth: 1 }),
    e({ type: 'text', x: 560, y: 477, w: 100, h: 10, text: '(подпись)', fontSize: 7, align: 'center', italic: true }),
    e({ type: 'text', x: 450, y: 494, w: 200, h: 14, text: '"    "           20    г.', fontSize: 9 }),

    e({ type: 'frame', x: 700, y: 430, w: 270, h: 110, lineStyle: 'dashed', frameLabel: 'Отметка бухгалтерии' }),
    e({ type: 'text', x: 710, y: 450, w: 250, h: 12, text: 'Корреспонденция счетов (графы 10, 11) отражена', fontSize: 8 }),
    e({ type: 'text', x: 710, y: 464, w: 250, h: 12, text: 'в журнале операций за _______ 20__ г.', fontSize: 8 }),
    e({ type: 'text', x: 710, y: 484, w: 250, h: 12, text: 'Исполнитель', fontSize: 8, bold: true }),
    e({ type: 'text', x: 710, y: 498, w: 250, h: 10, text: '(должность)   (подпись)   (расшифровка подписи)', fontSize: 7, italic: true }),
    e({ type: 'text', x: 710, y: 514, w: 250, h: 12, text: '"    "           20    г.', fontSize: 8 }),

    e({ type: 'text', x: 30, y: 530, w: 70, h: 16, text: 'Получил', fontSize: 10, bold: true }),
    e({ type: 'text', x: 105, y: 530, w: 100, h: 14, text: '', fontSize: 9, align: 'center' }),
    e({ type: 'line', x: 105, y: 544, w: 100, h: 1, lineStyle: 'solid', lineWidth: 1 }),
    e({ type: 'text', x: 105, y: 545, w: 100, h: 10, text: '(звание)', fontSize: 7, align: 'center', italic: true }),
    e({ type: 'text', x: 215, y: 530, w: 100, h: 14, text: '', fontSize: 9, align: 'center' }),
    e({ type: 'line', x: 215, y: 544, w: 100, h: 1, lineStyle: 'solid', lineWidth: 1 }),
    e({ type: 'text', x: 215, y: 545, w: 100, h: 10, text: '(подпись)', fontSize: 7, align: 'center', italic: true }),
    e({ type: 'text', x: 325, y: 530, w: 160, h: 14, text: '', fontSize: 9, align: 'center' }),
    e({ type: 'line', x: 325, y: 544, w: 160, h: 1, lineStyle: 'solid', lineWidth: 1 }),
    e({ type: 'text', x: 325, y: 545, w: 160, h: 10, text: '(расшифровка подписи)', fontSize: 7, align: 'center', italic: true }),
    e({ type: 'text', x: 40, y: 562, w: 150, h: 14, text: '', fontSize: 9, source: '{{date}}' }),
  ];

  return {
    id,
    name: 'Требование-накладная (форма 0504204)',
    companyName: '',
    signatory: '',
    signatoryRole: '',
    createdAt: now,
    updatedAt: now,
    elements,
    canvasWidth: 1414,
    canvasHeight: 1000,
  };
}