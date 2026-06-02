import { useMemo, useState } from 'react';

import useBackDismissible from '../../navigation/useBackDismissible';

import AnimationRightPanel from './panels/AnimationRightPanel';
import CustomInteractionRightPanel from './panels/CustomInteractionRightPanel';
import DesignRightPanel from './panels/DesignRightPanel';
import FormatRightPanel from './panels/FormatRightPanel';
import HelpRightPanel from './panels/HelpRightPanel';
import HomeRightPanel from './panels/HomeRightPanel';
import InsertRightPanel from './panels/InsertRightPanel';
import InteractionBuilderDialog from './panels/InteractionBuilderDialog';
import PublishRightPanel from './panels/PublishRightPanel';
import QuestionRightPanel from './panels/QuestionRightPanel';
import SceneRightPanel from './panels/SceneRightPanel';
import TransitionRightPanel from './panels/TransitionRightPanel';
import TtkbComplianceRightPanel from './panels/TtkbComplianceRightPanel';
import ViewRightPanel from './panels/ViewRightPanel';

export default function ContextRightPanel({ controller, inspectorProps, registerBackDismissible }) {
  const [interactionBuilderOpen, setInteractionBuilderOpen] = useState(false);
  const [customInteractionOpen, setCustomInteractionOpen] = useState(false);
  const [ttkbAuditorOpen, setTtkbAuditorOpen] = useState(false);
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

  useBackDismissible({
    id: 'interaction-builder',
    open: interactionBuilderOpen,
    onDismiss: () => setInteractionBuilderOpen(false),
    priority: 760,
    registerBackDismissible,
  });
  useBackDismissible({
    id: 'custom-interaction-panel',
    open: customInteractionOpen,
    onDismiss: () => setCustomInteractionOpen(false),
    priority: 750,
    registerBackDismissible,
  });
  useBackDismissible({
    id: 'ttkb-auditor-panel',
    open: ttkbAuditorOpen,
    onDismiss: () => setTtkbAuditorOpen(false),
    priority: 740,
    registerBackDismissible,
  });

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

  if (inspectorProps?.activeTab === 'soru') {
    return (
      <div style={{ position: 'relative', height: '100%', minHeight: 0 }}>
        <QuestionRightPanel controller={enhancedController} />
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: '#fbfdff',
      }}
    >
      {/* Global Quick-Actions Flex Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          flexShrink: 0,
          flexWrap: 'wrap',
          boxSizing: 'border-box',
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 900,
            color: '#64748b',
            marginRight: 'auto',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Hızlı Araçlar
        </span>

        <button
          type="button"
          onClick={() => setTtkbAuditorOpen((v) => !v)}
          title="TTKB Uyum Denetçisi V1"
          style={{
            height: 24,
            borderRadius: 7,
            border: `1px solid ${ttkbAuditorOpen ? '#bbf7d0' : '#e2e8f0'}`,
            background: ttkbAuditorOpen ? '#f0fdf4' : '#ffffff',
            color: ttkbAuditorOpen ? '#15803d' : '#64748b',
            cursor: 'pointer',
            fontSize: 10,
            fontWeight: 950,
            padding: '0 8px',
            boxShadow: '0 1px 4px rgba(15,23,42,.08)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ fontSize: 11 }}>✓</span> TTKB Denetçisi
        </button>

        <button
          type="button"
          onClick={() => setInteractionBuilderOpen(true)}
          title="Trigger ve değişkenleri düzenle"
          style={{
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
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ fontSize: 11 }}>⚡</span> Etkileşimler
        </button>

        {(controller?.activity?.type === 'custom-interaction' ||
          controller?.activity?.activityType === 'custom-interaction') && (
          <button
            type="button"
            onClick={() => setCustomInteractionOpen((v) => !v)}
            title="Özel etkileşim panelini aç/kapa"
            style={{
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 11 }}>⚙</span> Özel Etkileşim
          </button>
        )}
      </div>

      {/* Main Panel Content Container (Under the Toolbar) */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {panel}

        {(controller?.activity?.type === 'custom-interaction' ||
          controller?.activity?.activityType === 'custom-interaction') &&
          customInteractionOpen && (
            <div
              style={{
                position: 'absolute',
                top: 0,
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

        <InteractionBuilderDialog
          controller={enhancedController}
          open={interactionBuilderOpen}
          onClose={() => setInteractionBuilderOpen(false)}
        />

        {ttkbAuditorOpen && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 15,
              overflowY: 'auto',
              background: '#fbfdff',
            }}
          >
            <TtkbComplianceRightPanel
              controller={enhancedController}
              onClose={() => setTtkbAuditorOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
