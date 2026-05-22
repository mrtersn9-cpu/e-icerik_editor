import { useMemo, useState } from 'react';

import AnimationRightPanel from './panels/AnimationRightPanel';
import CustomInteractionRightPanel from './panels/CustomInteractionRightPanel';
import DesignRightPanel from './panels/DesignRightPanel';
import FormatRightPanel from './panels/FormatRightPanel';
import HelpRightPanel from './panels/HelpRightPanel';
import HomeRightPanel from './panels/HomeRightPanel';
import InsertRightPanel from './panels/InsertRightPanel';
import InteractionBuilderDialog from './panels/InteractionBuilderDialog';
import PublishRightPanel from './panels/PublishRightPanel';
import SceneRightPanel from './panels/SceneRightPanel';
import TransitionRightPanel from './panels/TransitionRightPanel';
import ViewRightPanel from './panels/ViewRightPanel';

export default function ContextRightPanel({ controller, inspectorProps }) {
  const [interactionBuilderOpen, setInteractionBuilderOpen] = useState(false);
  const [customInteractionOpen, setCustomInteractionOpen] = useState(false);
  const enhancedController = useMemo(() => {
    if (!controller) return controller;
    return {
      ...controller,
      commands: {
        ...(controller.commands || {}),
        openInteractionBuilder: () => setInteractionBuilderOpen(true),
      },
    };
  }, [controller]);

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

  let panel = <HomeRightPanel controller={enhancedController} />;

  if (enhancedController.activePanel === 'home' && enhancedController.selectedObject) {
    panel = <FormatRightPanel controller={enhancedController} />;
  }

  if (enhancedController.activePanel === 'animation') panel = <AnimationRightPanel controller={enhancedController} />;
  if (enhancedController.activePanel === 'design') {
    panel = <DesignRightPanel controller={enhancedController} inspectorProps={inspectorProps} />;
  }
  if (enhancedController.activePanel === 'format') panel = <FormatRightPanel controller={enhancedController} />;
  if (enhancedController.activePanel === 'insert') panel = <InsertRightPanel controller={enhancedController} />;
  if (enhancedController.activePanel === 'scene') panel = <SceneRightPanel controller={enhancedController} />;
  if (enhancedController.activePanel === 'transitions') {
    panel = <TransitionRightPanel controller={enhancedController} />;
  }
  if (enhancedController.activePanel === 'view') panel = <ViewRightPanel controller={enhancedController} />;
  if (enhancedController.activePanel === 'publish') panel = <PublishRightPanel controller={enhancedController} />;
  if (enhancedController.activePanel === 'help') panel = <HelpRightPanel controller={enhancedController} />;

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 0 }}>
      {(controller?.activity?.type === 'custom-interaction' ||
        controller?.activity?.activityType === 'custom-interaction') && (
        <button
          type="button"
          onClick={() => setCustomInteractionOpen((v) => !v)}
          title="Özel etkileşim panelini aç/kapa"
          style={{
            position: 'absolute',
            top: 8,
            right: 100,
            zIndex: 5,
            height: 24,
            borderRadius: 7,
            border: `1px solid ${customInteractionOpen ? '#bfdbfe' : '#e2e8f0'}`,
            background: customInteractionOpen ? '#eff6ff' : '#ffffff',
            color: customInteractionOpen ? '#1d4ed8' : '#64748b',
            cursor: 'pointer',
            fontSize: 10,
            fontWeight: 950,
            padding: '0 8px',
            boxShadow: '0 1px 4px rgba(15,23,42,.08)',
          }}
        >
          Özel Etkileşim
        </button>
      )}
      <button
        type="button"
        onClick={() => setInteractionBuilderOpen(true)}
        title="Trigger ve değişkenleri düzenle"
        style={{
          position: 'absolute',
          top: 8,
          right: 10,
          zIndex: 5,
          height: 24,
          borderRadius: 7,
          border: '1px solid #bfdbfe',
          background: '#ffffff',
          color: '#1d4ed8',
          cursor: 'pointer',
          fontSize: 10,
          fontWeight: 950,
          padding: '0 8px',
          boxShadow: '0 1px 4px rgba(15,23,42,.08)',
        }}
      >
        Etkileşimler
      </button>
      {(controller?.activity?.type === 'custom-interaction' ||
        controller?.activity?.activityType === 'custom-interaction') &&
        customInteractionOpen && (
          <div
            style={{
              position: 'absolute',
              top: 40,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10,
              overflowY: 'auto',
              background: '#fbfdff',
            }}
          >
            <CustomInteractionRightPanel controller={enhancedController} />
          </div>
        )}
      {panel}
      <InteractionBuilderDialog
        controller={enhancedController}
        open={interactionBuilderOpen}
        onClose={() => setInteractionBuilderOpen(false)}
      />
    </div>
  );
}
