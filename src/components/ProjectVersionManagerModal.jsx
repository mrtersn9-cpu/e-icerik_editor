import { EDITOR_THEME } from '../theme';
import { createLightPanelStyle } from '../theme';

import { Inp, Btn, Modal } from './ui';

export default function ProjectVersionManagerModal({
  open,
  onClose,
  dbStatus,
  currentProject,
  currentProjectId,
  projectNameDraft,
  onProjectNameChange,
  onSaveProjectName,
  newProjectName,
  onNewProjectNameChange,
  onCreateProject,
  projects,
  onSwitchProject,
  onDeleteProject,
  onDuplicateProject,
  versionLabel,
  onVersionLabelChange,
  onCreateVersion,
  onPublishVersion,
  versions,
  onRestoreVersion,
  onDeleteVersion,
  activityCount,
  books,
}) {
  if (!open) return null;

  const dbReady = dbStatus === 'connected';
  const modalCard = {
    ...createLightPanelStyle({ padding: 16 }),
    borderRadius: 18,
    boxShadow: '0 12px 28px rgba(15,23,42,.07)',
  };
  const sectionTitle = {
    fontSize: 11,
    fontWeight: 900,
    color: '#334155',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  };
  const statPill = {
    padding: '6px 10px',
    borderRadius: 999,
    border: `1px solid ${EDITOR_THEME.lightBorder}`,
    background: '#ffffff',
    color: '#475569',
    fontSize: 11,
    fontWeight: 800,
  };
  const projectCount = projects.length;
  const publishedCount = versions.filter((version) => version.isPublished).length;
  const totalBooks = Array.isArray(books) ? books.length : 0;

  return (
    <Modal title="Proje ve Surumler" onClose={onClose} width={1100}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr .9fr',
          gap: 18,
          background: `linear-gradient(180deg, ${EDITOR_THEME.lightBg}, #eef6ff)`,
          borderRadius: 20,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Active project */}
          <div style={modalCard}>
            <div style={{ ...sectionTitle, color: '#0f5d8e' }}>Aktif Proje</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <Inp
                    label="Proje Adi"
                    value={projectNameDraft}
                    onChange={(e) => onProjectNameChange(e.target.value)}
                    placeholder="Proje adi..."
                  />
                </div>
                <Btn
                  onClick={onSaveProjectName}
                  color={EDITOR_THEME.shellAccentStrong}
                  disabled={!dbReady || !currentProject}
                >
                  Kaydet
                </Btn>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span style={statPill}>ID: {currentProject?.id?.slice(0, 8) || '-'}</span>
                <span style={statPill}>Aktivite: {activityCount}</span>
                <span style={statPill}>Kitap: {totalBooks}</span>
                <span
                  style={{
                    ...statPill,
                    color: currentProject?.publishedVersionId ? '#15803d' : '#64748b',
                    background: currentProject?.publishedVersionId ? '#ecfdf5' : '#ffffff',
                    borderColor: currentProject?.publishedVersionId
                      ? '#86efac'
                      : EDITOR_THEME.lightBorder,
                  }}
                >
                  {currentProject?.publishedVersionId ? 'Yayinda' : 'Yayinda degil'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Taslak guncelleme:{' '}
                {currentProject?.draftUpdatedAt
                  ? new Date(currentProject.draftUpdatedAt).toLocaleString('tr-TR')
                  : '-'}
              </div>
              {currentProjectId && dbReady && (
                <div
                  style={{
                    fontSize: 11,
                    color: '#475569',
                    background: '#f8fbff',
                    border: `1px solid ${EDITOR_THEME.lightBorder}`,
                    borderRadius: 14,
                    padding: 12,
                    lineHeight: 1.6,
                  }}
                >
                  Harici SCORM indirme kaldırıldı. Proje artık yalnızca editör ve FTP yayın akışıyla
                  devam eder.
                </div>
              )}
              {!dbReady && (
                <div style={{ fontSize: 11, color: '#b45309' }}>
                  Veritabanı baglantisi yoksa surumleme ozellikleri pasif kalir.
                </div>
              )}
            </div>
          </div>

          {/* New project */}
          <div style={modalCard}>
            <div style={{ ...sectionTitle, color: '#6d28d9' }}>Yeni Proje</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <Inp
                  label="Bos Proje Adi"
                  value={newProjectName}
                  onChange={(e) => onNewProjectNameChange(e.target.value)}
                  placeholder="Yeni proje..."
                />
              </div>
              <Btn onClick={onCreateProject} color="#7C4DFF" disabled={!dbReady}>
                Olustur
              </Btn>
            </div>
          </div>

          {/* Version create */}
          <div style={modalCard}>
            <div style={{ ...sectionTitle, color: '#15803d' }}>Surum Olustur</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <Inp
                  label="Etiket"
                  value={versionLabel}
                  onChange={(e) => onVersionLabelChange(e.target.value)}
                  placeholder="Orn. Beta 1 / Nisan Guncellemesi"
                />
              </div>
              <Btn
                onClick={() => onCreateVersion(false)}
                color="#4CAF50"
                disabled={!dbReady || !currentProject}
              >
                Surum Al
              </Btn>
              <Btn
                onClick={() => onCreateVersion(true)}
                color="#FF9800"
                disabled={!dbReady || !currentProject}
              >
                Yayinla
              </Btn>
            </div>
          </div>

          {/* Version history */}
          <div style={{ ...modalCard, minHeight: 200 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 10,
                flexWrap: 'wrap',
              }}
            >
              <div style={sectionTitle}>Surum Gecmisi</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={statPill}>{versions.length} surum</span>
                <span style={statPill}>{publishedCount} yayin</span>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                maxHeight: 320,
                overflowY: 'auto',
                paddingRight: 4,
              }}
            >
              {versions.length ? (
                versions.map((version) => (
                  <div
                    key={version.id}
                    style={{
                      border: `1px solid ${version.isPublished ? '#f59e0b' : EDITOR_THEME.lightBorder}`,
                      background: version.isPublished ? '#fff7ed' : '#ffffff',
                      borderRadius: 14,
                      padding: 12,
                      boxShadow: '0 8px 18px rgba(15,23,42,.05)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            color: version.isPublished ? '#b45309' : '#0f172a',
                          }}
                        >
                          v{version.versionNo} · {version.label}
                          {version.isPublished && (
                            <span
                              style={{
                                marginLeft: 6,
                                fontSize: 11,
                                padding: '3px 7px',
                                borderRadius: 999,
                                background: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #fcd34d',
                              }}
                            >
                              Yayinda
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                          {new Date(version.createdAt).toLocaleString('tr-TR')}
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 5,
                          alignItems: 'center',
                          flexShrink: 0,
                          flexWrap: 'wrap',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <Btn
                          onClick={() => onRestoreVersion(version.id)}
                          color={EDITOR_THEME.shellAccentStrong}
                          small
                          disabled={!dbReady}
                        >
                          Geri Yükle
                        </Btn>
                        {!version.isPublished && (
                          <Btn
                            onClick={() => onPublishVersion(version.id)}
                            color="#FF9800"
                            small
                            disabled={!dbReady}
                          >
                            Yayinla
                          </Btn>
                        )}
                        <Btn
                          onClick={() => onDeleteVersion(version.id)}
                          color="#f44336"
                          small
                          disabled={!dbReady}
                        >
                          Sil
                        </Btn>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    fontSize: 11,
                    color: '#667085',
                    textAlign: 'center',
                    padding: '24px 12px',
                    border: `1px dashed ${EDITOR_THEME.lightBorderStrong}`,
                    borderRadius: 14,
                  }}
                >
                  Henuz surum alinmadi.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Projects list */}
        <div style={{ ...modalCard, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 10,
              flexWrap: 'wrap',
            }}
          >
            <div style={sectionTitle}>Projeler ({projectCount})</div>
            <span style={statPill}>{currentProject ? '1 aktif' : 'Aktif yok'}</span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflowY: 'auto',
              maxHeight: 640,
              paddingRight: 4,
            }}
          >
            {projects.length ? (
              projects.map((project) => {
                const isCurrent = project.id === currentProject?.id;
                return (
                  <div
                    key={project.id}
                    style={{
                      border: `1px solid ${isCurrent ? '#7dd3fc' : EDITOR_THEME.lightBorder}`,
                      background: isCurrent ? '#eff8ff' : '#ffffff',
                      borderRadius: 14,
                      padding: 12,
                      boxShadow: isCurrent
                        ? '0 12px 24px rgba(14,165,233,.1)'
                        : '0 8px 18px rgba(15,23,42,.04)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            color: isCurrent ? '#0f5d8e' : '#0f172a',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isCurrent && (
                            <span
                              style={{
                                fontSize: 11,
                                marginRight: 5,
                                padding: '3px 6px',
                                background: '#dff6ff',
                                border: '1px solid #7dd3fc',
                                borderRadius: 999,
                                color: '#0f5d8e',
                              }}
                            >
                              Aktif
                            </span>
                          )}
                          {project.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                          Taslak: {new Date(project.draftUpdatedAt).toLocaleString('tr-TR')}
                        </div>
                        {project.publishedVersionId && (
                          <div style={{ fontSize: 11, color: '#15803d', marginTop: 2 }}>
                            Yayinda surumu var
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 5,
                          flexShrink: 0,
                          flexWrap: 'wrap',
                          justifyContent: 'flex-end',
                        }}
                      >
                        {!isCurrent && (
                          <Btn
                            onClick={() => onSwitchProject(project.id)}
                            color={EDITOR_THEME.shellAccentStrong}
                            small
                            disabled={!dbReady}
                          >
                            Ac
                          </Btn>
                        )}
                        <Btn
                          onClick={() => onDuplicateProject(project.id, project.name)}
                          color="#9C27B0"
                          small
                          disabled={!dbReady}
                        >
                          Çoğalt
                        </Btn>
                        <Btn
                          onClick={() => onDeleteProject(project.id)}
                          color="#f44336"
                          small
                          disabled={!dbReady || projects.length <= 1}
                        >
                          Sil
                        </Btn>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  fontSize: 11,
                  color: '#667085',
                  textAlign: 'center',
                  padding: '24px 12px',
                  border: `1px dashed ${EDITOR_THEME.lightBorderStrong}`,
                  borderRadius: 14,
                }}
              >
                Henuz proje yok.
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
