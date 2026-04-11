export type LabelSize = 'small' | 'medium' | 'large';

export type LabelSizeConfig = {
  label: string;
  dims: string;
  width: string;
  height: string;
  fontSize: string;
  barcodeW: number;
  barcodeH: number;
  nameTruncate: number;
};

export const LABEL_CONFIG: Record<LabelSize, LabelSizeConfig> = {
  small: {
    label: 'Маленький',
    dims: '40x25 мм',
    width: 'w-[150px]',
    height: 'h-[95px]',
    fontSize: 'text-[9px]',
    barcodeW: 1,
    barcodeH: 25,
    nameTruncate: 22,
  },
  medium: {
    label: 'Средний',
    dims: '58x40 мм',
    width: 'w-[220px]',
    height: 'h-[150px]',
    fontSize: 'text-[11px]',
    barcodeW: 1.5,
    barcodeH: 40,
    nameTruncate: 32,
  },
  large: {
    label: 'Большой',
    dims: '100x50 мм',
    width: 'w-[375px]',
    height: 'h-[190px]',
    fontSize: 'text-[13px]',
    barcodeW: 2,
    barcodeH: 55,
    nameTruncate: 50,
  },
};

export type LabelDataEntry = {
  item: import('@/data/store').Item;
  barcodeValue: string;
  categoryName: string;
  locationName: string;
  warehouseName: string;
};

export function getNoun(n: number, one: string, two: string, five: string): string {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return five;
  if (n1 > 1 && n1 < 5) return two;
  if (n1 === 1) return one;
  return five;
}
