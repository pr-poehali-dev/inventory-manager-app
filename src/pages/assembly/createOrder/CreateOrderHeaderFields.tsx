import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import Autocomplete, { AutocompleteOption } from '@/components/Autocomplete';
import { AppState } from '@/data/store';

type Props = {
  state: AppState;
  number: string;
  setNumber: (v: string) => void;
  selectedWarehouseId: string;
  setSelectedWarehouseId: (v: string) => void;
  recipientLabel: string;
  setRecipientLabel: (v: string) => void;
  setRecipientId: (v: string) => void;
  recipientOptions: AutocompleteOption[];
  receiverRank: string;
  setReceiverRank: (v: string) => void;
  receiverName: string;
  setReceiverName: (v: string) => void;
  requesterRank: string;
  setRequesterRank: (v: string) => void;
  requesterName: string;
  setRequesterName: (v: string) => void;
  comment: string;
  setComment: (v: string) => void;
};

export function CreateOrderHeaderFields({
  state,
  number, setNumber,
  selectedWarehouseId, setSelectedWarehouseId,
  recipientLabel, setRecipientLabel, setRecipientId,
  recipientOptions,
  receiverRank, setReceiverRank,
  receiverName, setReceiverName,
  requesterRank, setRequesterRank,
  requesterName, setRequesterName,
  comment, setComment,
}: Props) {
  return (
    <>
      {/* Number */}
      <div className="space-y-1.5 max-w-[200px]">
        <Label>Номер</Label>
        <Input value={number} onChange={e => setNumber(e.target.value)} placeholder="ЗС-001" />
      </div>

      {/* Warehouse selector */}
      {(state.warehouses || []).length > 0 && (
        <div className="space-y-1.5">
          <Label>Склад-отправитель</Label>
          <div className="flex flex-wrap gap-2">
            {(state.warehouses || []).map(wh => (
              <button
                key={wh.id}
                type="button"
                onClick={() => setSelectedWarehouseId(wh.id === selectedWarehouseId ? '' : wh.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all
                  ${selectedWarehouseId === wh.id
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-muted/40 border-border text-foreground hover:bg-muted'
                  }`}
              >
                <Icon name="Warehouse" size={14} />
                {wh.name}
              </button>
            ))}
          </div>
          {!selectedWarehouseId && (
            <p className="text-xs text-warning">Выберите склад — список товаров будет ограничен его остатками</p>
          )}
          {selectedWarehouseId && (
            <p className="text-xs text-muted-foreground">Показаны только товары с остатком на выбранном складе</p>
          )}
        </div>
      )}

      {/* Recipient autocomplete */}
      <div className="space-y-1.5">
        <Label>Структурное подразделение — получатель</Label>
        <Autocomplete
          value={recipientLabel}
          onChange={v => { setRecipientLabel(v); setRecipientId(''); }}
          onSelect={opt => {
            setRecipientLabel(opt.label);
            const pid = opt.id === '__new__' ? '' : opt.id;
            setRecipientId(pid);
            if (pid) {
              const partner = state.partners.find(p => p.id === pid);
              if (partner) {
                if (partner.rank && !receiverRank.trim()) setReceiverRank(partner.rank);
                if (partner.fullName && !receiverName.trim()) setReceiverName(partner.fullName);
              }
            }
          }}
          options={recipientOptions}
          placeholder="Введите получателя..."
          allowCustom
        />
        <p className="text-xs text-muted-foreground">Структурное подразделение — получатель (для накладной)</p>
      </div>

      {/* Requester for invoice */}
      <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <Icon name="UserPlus" size={12} />
          Затребовал (кто запросил ТМЦ)
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Должность</Label>
            <Input value={requesterRank} onChange={e => setRequesterRank(e.target.value)} placeholder="Напр.: командир взвода" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">ФИО</Label>
            <Input value={requesterName} onChange={e => setRequesterName(e.target.value)} placeholder="Сидоров С.С." />
          </div>
        </div>
      </div>

      {/* Receiver for invoice */}
      <div className="rounded-xl border-2 border-success/30 bg-success/5 p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-success uppercase tracking-wide">
          <Icon name="UserCheck" size={12} />
          Получил — кто фактически забирает ТМЦ
        </div>
        <p className="text-[11px] text-muted-foreground -mt-1">
          Подразделение укажи выше в «Кому выдаём». Здесь — должность и ФИО того, кто расписывается.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Должность / звание</Label>
            <Input value={receiverRank} onChange={e => setReceiverRank(e.target.value)} placeholder="Напр.: кладовщик" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">ФИО (расшифровка подписи)</Label>
            <Input value={receiverName} onChange={e => setReceiverName(e.target.value)} placeholder="Иванов И.И." />
          </div>
        </div>
      </div>

      {/* Comment */}
      <div className="space-y-1.5">
        <Label>Комментарий</Label>
        <Input value={comment} onChange={e => setComment(e.target.value)} placeholder="Примечание, приоритет..." />
      </div>
    </>
  );
}
