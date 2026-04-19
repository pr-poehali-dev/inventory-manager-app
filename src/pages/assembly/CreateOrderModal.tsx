import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { AppState, WorkOrder } from '@/data/store';
import { ConflictModal } from './ConflictModal';
import { useCreateOrderLogic } from './createOrder/useCreateOrderLogic';
import { CreateOrderHeaderFields } from './createOrder/CreateOrderHeaderFields';
import { OrderLinesList } from './createOrder/OrderLinesList';

export function CreateOrderModal({
  state, onStateChange, onClose, editOrder,
}: {
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
  editOrder?: WorkOrder;
}) {
  const logic = useCreateOrderLogic({ state, onStateChange, onClose, editOrder });

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl xl:max-w-4xl max-h-[94vh] overflow-y-auto animate-scale-in">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Icon name={logic.isEdit ? 'Pencil' : 'ClipboardPlus'} size={16} />
              </div>
              {logic.isEdit ? 'Редактировать заявку' : 'Новая сборочная заявка'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <CreateOrderHeaderFields
              state={state}
              number={logic.number}
              setNumber={logic.setNumber}
              selectedWarehouseId={logic.selectedWarehouseId}
              setSelectedWarehouseId={logic.setSelectedWarehouseId}
              recipientLabel={logic.recipientLabel}
              setRecipientLabel={logic.setRecipientLabel}
              setRecipientId={logic.setRecipientId}
              recipientOptions={logic.recipientOptions}
              receiverRank={logic.receiverRank}
              setReceiverRank={logic.setReceiverRank}
              receiverName={logic.receiverName}
              setReceiverName={logic.setReceiverName}
              requesterRank={logic.requesterRank}
              setRequesterRank={logic.setRequesterRank}
              requesterName={logic.requesterName}
              setRequesterName={logic.setRequesterName}
              comment={logic.comment}
              setComment={logic.setComment}
            />

            <OrderLinesList
              state={state}
              lines={logic.lines}
              validLinesCount={logic.validLines.length}
              duplicates={logic.duplicates}
              lineWarnings={logic.lineWarnings}
              itemOptions={logic.itemOptions}
              conflicts={logic.conflicts}
              onAddLine={logic.addLine}
              onUpdateLine={logic.updateLine}
              onRemoveLine={logic.removeLine}
            />

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
              <Button onClick={logic.handleSubmit} disabled={!logic.canCreate} className="flex-1">
                <Icon name={logic.isEdit ? 'Save' : 'Plus'} size={15} className="mr-1.5" />
                {logic.isEdit ? 'Сохранить' : 'Создать заявку'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {logic.showConflict && (
        <ConflictModal
          conflicts={logic.conflicts}
          onResolve={() => logic.setShowConflict(false)}
          onForce={() => { logic.setShowConflict(false); logic.doCreate('pending_stock'); }}
          onCancel={() => logic.setShowConflict(false)}
        />
      )}
    </>
  );
}
