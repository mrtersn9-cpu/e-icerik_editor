import { useEffect, useState } from 'react';

import { Modal, Inp, Btn } from './ui';

export default function FindReplaceModal({ open, onClose, onCount, onReplace, title = 'Bul ve Değiştir' }) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (open) {
      setFind('');
      setReplace('');
      setStatus('');
    }
  }, [open]);

  if (!open) return null;

  const matchCount = find ? onCount?.(find) || 0 : 0;

  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Btn onClick={onClose}>Kapat</Btn>
          <Btn
            variant="primary"
            disabled={!find}
            onClick={() => {
              const replaced = onReplace?.(find, replace) || 0;
              setStatus(replaced ? `${replaced} değişiklik yapıldı.` : 'Eşleşme bulunamadı.');
            }}
          >
            Tümünü Değiştir
          </Btn>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Inp value={find} onChange={(e) => setFind(e.target.value)} placeholder="Aranan metin" autoFocus />
        <Inp value={replace} onChange={(e) => setReplace(e.target.value)} placeholder="Yeni metin" />
        <div style={{ fontSize: 12, color: 'var(--eic-light-muted)', minHeight: 16 }}>
          {status || (find ? `${matchCount} eşleşme bulundu (bu etkinlikte)` : 'Aranan metni yazın')}
        </div>
      </div>
    </Modal>
  );
}
