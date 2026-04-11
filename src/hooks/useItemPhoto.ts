import { useState } from 'react';
import { Item, AppState, crudAction } from '@/data/store';

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

export type UseItemPhotoResult = {
  uploading: boolean;
  error: string;
  selectPhoto: (file: File | null | undefined) => void;
  removePhoto: () => void;
  setPhotoFromDataUrl: (dataUrl: string) => void;
};

/**
 * Единая логика загрузки/удаления главного фото товара.
 * Используется в ItemDetailModal и других местах, где нужно менять item.imageUrl.
 */
export function useItemPhoto(
  item: Item,
  state: AppState,
  onStateChange: (s: AppState) => void,
): UseItemPhotoResult {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const apply = (imageUrl: string | undefined) => {
    const updatedItem: Item = { ...item, imageUrl };
    const next: AppState = {
      ...state,
      items: state.items.map(i => i.id === item.id ? updatedItem : i),
    };
    onStateChange(next);
    crudAction('upsert_item', { item: updatedItem });
  };

  const selectPhoto = (file: File | null | undefined) => {
    setError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Только изображения');
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setError('Размер не больше 5 МБ');
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      apply(String(reader.result || ''));
      setUploading(false);
    };
    reader.onerror = () => {
      setError('Ошибка чтения файла');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => apply(undefined);

  const setPhotoFromDataUrl = (dataUrl: string) => apply(dataUrl);

  return { uploading, error, selectPhoto, removePhoto, setPhotoFromDataUrl };
}
