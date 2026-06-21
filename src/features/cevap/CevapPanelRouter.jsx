import { isTrueFalseActivity } from './cevapSelectors';
import AnketCevapPanel from './panels/AnketCevapPanel';
import BoslukDoldurmaCevapPanel from './panels/BoslukDoldurmaCevapPanel';
import DogruYanlisCevapPanel from './panels/DogruYanlisCevapPanel';
import EslesmeCevapPanel from './panels/EslesmeCevapPanel';
import EtiketliGorselPanel from './panels/EtiketliGorselPanel';
import FlashcardCevapPanel from './panels/FlashcardCevapPanel';
import HotspotCevapPanel from './panels/HotspotCevapPanel';
import KarmaCevapPanel from './panels/KarmaCevapPanel';
import KaydiriciCevapPanel from './panels/KaydiriciCevapPanel';
import KisaCevapCevapPanel from './panels/KisaCevapCevapPanel';
import KisayolTusuCevapPanel from './panels/KisayolTusuCevapPanel';
import PuzzleCevapPanel from './panels/PuzzleCevapPanel';
import SayisalCevapPanel from './panels/SayisalCevapPanel';
import SecmeCevapPanel from './panels/SecmeCevapPanel';
import SekmeIcerikPanel from './panels/SekmeIcerikPanel';
import SiralamaCevapPanel from './panels/SiralamaCevapPanel';
import SurukleBirakCevapPanel from './panels/SurukleBirakCevapPanel';

export default function CevapPanelRouter({ activity, onUpdate }) {
  if (!activity) {
    return <div style={{ color: '#64748b', fontSize: 13 }}>Önce bir etkinlik seçin.</div>;
  }
  if (isTrueFalseActivity(activity)) return <DogruYanlisCevapPanel activity={activity} onUpdate={onUpdate} />;
  // Eşleştirme artık sürükle-bırak motoruyla çalışır (sol öğeleri sağ alanlara taşı).
  if (activity.type === 'drag-drop' || activity.type === 'matching')
    return <SurukleBirakCevapPanel activity={activity} onUpdate={onUpdate} />;
  // Çizgi/halat eşleştirme: sol-sağ çiftleri + halat çizgi runtime'ı.
  if (activity.type === 'line-match' || activity.type === 'dropdown-match') return <EslesmeCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'sequence') return <SiralamaCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'text-entry') return <KisaCevapCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'numeric') return <SayisalCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'slider') return <KaydiriciCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'shortcut-key') return <KisayolTusuCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'fill-blank' || activity.type === 'word-bank') return <BoslukDoldurmaCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'survey') return <AnketCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'mixed') return <KarmaCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'hotspot') return <HotspotCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'puzzle') return <PuzzleCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'flashcard') return <FlashcardCevapPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'labeled-image') return <EtiketliGorselPanel activity={activity} onUpdate={onUpdate} />;
  if (activity.type === 'content-tabs') return <SekmeIcerikPanel activity={activity} onUpdate={onUpdate} />;
  return <SecmeCevapPanel activity={activity} onUpdate={onUpdate} />;
}

