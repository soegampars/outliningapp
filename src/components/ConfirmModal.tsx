interface Props {
  title: string;
  body: string;
  okLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

// Small cautionary dialog (used for New / Open, which replace the project).
export function ConfirmModal({ title, body, okLabel, onCancel, onConfirm }: Props) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__title">{title}</div>
        <div className="modal__body">{body}</div>
        <div className="modal__actions">
          <button className="spine-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="spine-btn modal__danger" onClick={onConfirm}>
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
