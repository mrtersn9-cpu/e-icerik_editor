import { isTrueFalseActivity } from './cevapSelectors';
import AnketCevapPanel from './panels/AnketCevapPanel';
import BoslukDoldurmaCevapPanel from './panels/BoslukDoldurmaCevapPanel';
import DogruYanlisCevapPanel from './panels/DogruYanlisCevapPanel';
import EslesmeCevapPanel from './panels/EslesmeCevapPanel';
import HotspotCevapPanel from './panels/HotspotCevapPanel';
import KarmaCevapPanel from './panels/KarmaCevapPanel';
import KisaCevapCevapPanel from './panels/KisaCevapCevapPanel';
import PuzzleCevapPanel from './panels/PuzzleCevapPanel';
import SayisalCevapPanel from './panels/SayisalCevapPanel';
import SecmeCevapPanel from './panels/SecmeCevapPanel';
import SiralamaCevapPanel from './panels/SiralamaCevapPanel';
import SurukleBirakCevapPanel from './panels/SurukleBirakCevapPanel';

export default function CevapPanelRouter({ activity, onUpdate }) {
  if (!activity) {
    return <div style={{ color: '#64748b', fontSize: 13 }}>Önce bir etkinlik seçin.</div>;
  }
  if (isTrueFalseActivity(activity)) return <DogruYanlisCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'drag-drop') return <SurukleBirakCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'matching') return <EslesmeCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'sequence') return <SiralamaCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'text-entry') return <KisaCevapCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'numeric') return <SayisalCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'fill-blank') return <BoslukDoldurmaCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'survey') return <AnketCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'mixed') return <KarmaCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'hotspot') return <HotspotCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'puzzle') return <PuzzleCevapPanel activity={activity} onUpdate={onUpdate} />;
  return <SecmeCevapPanel activity={activity} onUpdate={onUpdate} />;
}

