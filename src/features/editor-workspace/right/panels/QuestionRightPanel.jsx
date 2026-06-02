import FillBlankEditor from '../../../../components/activity-editors/FillBlankEditor';
import HotspotEditor from '../../../../components/activity-editors/HotspotEditor';
import MatchingEditor from '../../../../components/activity-editors/MatchingEditor';
import NumericEditor from '../../../../components/activity-editors/NumericEditor';
import PuzzleEditor from '../../../../components/activity-editors/PuzzleEditor';
import SelectionEditor from '../../../../components/activity-editors/SelectionEditor';
import SequenceEditor from '../../../../components/activity-editors/SequenceEditor';
import SurveyEditor from '../../../../components/activity-editors/SurveyEditor';
import TextEntryEditor from '../../../../components/activity-editors/TextEntryEditor';

export default function QuestionRightPanel({ controller }) {
  const activity = controller?.activity;
  const onUpdate = controller?.onUpdateActivity;
  if (!activity) {
    return (
      <div style={{ padding: 18, color: '#64748b', fontSize: 12 }}>
        Etkinlik seçilmediğinde soru düzenlenemez.
      </div>
    );
  }

  const type = activity.type;

  if (type === 'mixed') {
    return (
      <div style={{ padding: 18, color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
        <strong>Karma Etkinlik Yönetimi</strong><br /><br />
        Karma etkinlik sorularını ve cevap anahtarlarını, yukarıdaki <strong>Cevap</strong> sekmesinden yönetebilirsiniz.
      </div>
    );
  }
  if (type === 'puzzle') {
    return <PuzzleEditor activity={activity} onUpdate={onUpdate} />;
  }
  if (type === 'hotspot') {
    return <HotspotEditor activity={activity} onUpdate={onUpdate} />;
  }
  if (type === 'selection') {
    return <SelectionEditor activity={activity} onUpdate={onUpdate} />;
  }
  if (type === 'sequence') {
    return <SequenceEditor activity={activity} onUpdate={onUpdate} />;
  }
  if (type === 'matching') {
    return <MatchingEditor activity={activity} onUpdate={onUpdate} />;
  }
  if (type === 'text-entry') {
    return <TextEntryEditor activity={activity} onUpdate={onUpdate} />;
  }
  if (type === 'numeric') {
    return <NumericEditor activity={activity} onUpdate={onUpdate} />;
  }
  if (type === 'fill-blank') {
    return <FillBlankEditor activity={activity} onUpdate={onUpdate} />;
  }
  if (type === 'survey') {
    return <SurveyEditor activity={activity} onUpdate={onUpdate} />;
  }

  return (
    <div style={{ padding: 18, color: '#64748b', fontSize: 12 }}>
      Bu etkinlik türü için soru düzenleyici henüz mevcut değil.
    </div>
  );
}
