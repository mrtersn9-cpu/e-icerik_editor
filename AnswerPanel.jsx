import SelectionEditor from '../../../../../components/activity-editors/SelectionEditor';
import MixedActivityEditor from '../../../../../components/activity-editors/MixedActivityEditor';
import SequenceEditor from '../../../../../components/activity-editors/SequenceEditor';
import DragDropConfigPanel from '../../../../../components/activity-editors/DragDropConfigPanel';
import MatchingEditor from '../../../../../components/activity-editors/MatchingEditor';
import TextEntryEditor from '../../../../../components/activity-editors/TextEntryEditor';
import NumericEditor from '../../../../../components/activity-editors/NumericEditor';
import FillBlankEditor from '../../../../../components/activity-editors/FillBlankEditor';
import SurveyEditor from '../../../../../components/activity-editors/SurveyEditor';

function AnswerPanel({ selActivity, updateActivity }) {
  if (!selActivity) {
    return <div>Etkinlik bulunamadı.</div>;
  }

  const editorProps = {
    activity: selActivity,
    onUpdate: updateActivity,
  };

  const renderContent = () => {
    switch (selActivity.type) {
      case 'selection':
        return <SelectionEditor {...editorProps} />;
      case 'mixed':
        return <MixedActivityEditor {...editorProps} />;
      case 'sequence':
        return <SequenceEditor {...editorProps} />;
      case 'drag-drop':
        return <DragDropConfigPanel {...editorProps} />;
      case 'matching':
        return <MatchingEditor {...editorProps} />;
      case 'text-entry':
        return <TextEntryEditor {...editorProps} />;
      case 'numeric':
        return <NumericEditor {...editorProps} />;
      case 'fill-blank':
        return <FillBlankEditor {...editorProps} />;
      case 'survey':
        return <SurveyEditor {...editorProps} />;
      default:
        return (
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Bu etkinlik türü için özel bir cevap editörü bulunmuyor.
          </div>
        );
    }
  };

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{renderContent()}</div>;
}

export default AnswerPanel;