import SecmeCevapPanel from './SecmeCevapPanel';
import SurukleBirakCevapPanel from './SurukleBirakCevapPanel';

export default function KarmaCevapPanel({ activity, onUpdate }) {
  const hasDragDrop = (activity.objects || []).some(
    (object) => object.type === 'draggable' || object.type === 'dropzone'
  );
  if (hasDragDrop) return <SurukleBirakCevapPanel activity={activity} onUpdate={onUpdate} />;
  return <SecmeCevapPanel activity={activity} onUpdate={onUpdate} />;
}
