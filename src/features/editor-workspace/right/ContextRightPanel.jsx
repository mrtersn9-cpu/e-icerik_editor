import { RightInspectorPhase2 } from '../../../components/RightInspector';

import HelpRightPanel from './panels/HelpRightPanel';
import HomeRightPanel from './panels/HomeRightPanel';
import InsertRightPanel from './panels/InsertRightPanel';
import PublishRightPanel from './panels/PublishRightPanel';
import TransitionRightPanel from './panels/TransitionRightPanel';
import ViewRightPanel from './panels/ViewRightPanel';

const inspectorPanelByContext = {
  animation: { tab: 'timeline' },
  design: { tab: 'scene', scenePanelMode: 'style', title: 'Stiller' },
  format: { tab: 'object' },
  scene: { tab: 'scene', scenePanelMode: 'settings', title: 'Sahne Ayarları' },
};

function InspectorContextPanel({ controller, forcedInspectorTab, inspectorProps, scenePanelMode, title }) {
  return (
    <RightInspectorPhase2
      {...inspectorProps}
      activeTab={inspectorProps?.activeTab || 'nesneler'}
      forcedInspectorTab={forcedInspectorTab}
      hideInspectorTabs
      hideLayerManagement
      scenePanelMode={scenePanelMode || 'all'}
      workspaceTitle={
        title ||
        (forcedInspectorTab === 'scene'
          ? 'Sahne Ayarları'
          : forcedInspectorTab === 'timeline'
            ? 'Animasyon Ayarları'
            : 'Seçili Nesne Ayarları')
      }
      onOpenAnswerCenter={controller.onOpenAnswerCenter}
    />
  );
}

export default function ContextRightPanel({ controller, inspectorProps }) {
  if (!controller?.activity) {
    return (
      <div
        style={{
          height: '100%',
          background: '#fbfdff',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 18,
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 750,
          lineHeight: 1.5,
        }}
      >
        Etkinlik seçildiğinde sağ panel ribbon sekmesine göre açılır.
      </div>
    );
  }

  const forcedInspectorConfig = inspectorPanelByContext[controller.activePanel];
  if (forcedInspectorConfig) {
    return (
      <InspectorContextPanel
        controller={controller}
        forcedInspectorTab={forcedInspectorConfig.tab}
        inspectorProps={inspectorProps}
        scenePanelMode={forcedInspectorConfig.scenePanelMode}
        title={forcedInspectorConfig.title}
      />
    );
  }

  if (controller.activePanel === 'insert') return <InsertRightPanel controller={controller} />;
  if (controller.activePanel === 'transitions') {
    return <TransitionRightPanel controller={controller} />;
  }
  if (controller.activePanel === 'view') return <ViewRightPanel controller={controller} />;
  if (controller.activePanel === 'publish') return <PublishRightPanel controller={controller} />;
  if (controller.activePanel === 'help') return <HelpRightPanel controller={controller} />;

  return <HomeRightPanel controller={controller} />;
}
