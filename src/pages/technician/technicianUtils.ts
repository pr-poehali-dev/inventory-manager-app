export const DOC_TYPES = ['Накладная', 'Акт', 'Паспорт изделия', 'Инструкция', 'Сертификат', 'Договор', 'Счёт', 'Иное'];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso; }
}

export function getFileIcon(mime: string, name: string): { icon: string; color: string } {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (mime.startsWith('image/'))                                                          return { icon: 'Image',    color: 'text-blue-500' };
  if (mime.includes('pdf'))                                                               return { icon: 'FileText', color: 'text-red-500' };
  if (mime.includes('word') || ext === 'docx' || ext === 'doc')                          return { icon: 'FileText', color: 'text-blue-600' };
  if (mime.includes('excel') || mime.includes('spreadsheet') || ext === 'xlsx' || ext === 'xls')
                                                                                          return { icon: 'Table',    color: 'text-green-600' };
  if (mime.includes('zip') || mime.includes('rar'))                                      return { icon: 'Archive',  color: 'text-yellow-600' };
  return { icon: 'File', color: 'text-muted-foreground' };
}
