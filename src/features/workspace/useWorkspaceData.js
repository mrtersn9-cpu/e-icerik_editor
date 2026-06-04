import { useCallback } from 'react';

/**
 * Çalışma alanı (workspace) meta verisini — geçerli proje, proje listesi,
 * sürümler ve proje adı taslağı — güncelleyen yardımcılar. A3.4 workspace-sync
 * concern'inin effect-DIŞI, düşük riskli alt parçasıdır; yükleme/kaydetme/
 * reconnect effect'leri ve loadWorkspaceState (normalizeState + writeBrowserRoute
 * + ~9 setter'a bağlı) bilinçli olarak monolitte bırakılmıştır.
 *
 * EIcerikEditor'dan birebir taşınmıştır. State setter'ları ve currentProjectId
 * options ile geçirilir; setter'lar dep dizilerine eklenmiştir (stable; davranış aynı).
 *
 * @returns {{ syncWorkspaceMeta: Function, mergeWorkspaceProjectData: Function }}
 */
export default function useWorkspaceData({
  currentProjectId,
  setWorkspaceInfo,
  setProjectNameDraft,
}) {
  const syncWorkspaceMeta = useCallback(
    (workspace) => {
      if (!workspace) return;
      const nextCurrentProject = workspace.currentProject || null;
      setWorkspaceInfo({
        currentProject: nextCurrentProject,
        projects: Array.isArray(workspace.projects) ? workspace.projects : [],
        versions: Array.isArray(workspace.versions) ? workspace.versions : [],
      });
      setProjectNameDraft((prev) => {
        if (nextCurrentProject?.id && nextCurrentProject.id === currentProjectId) {
          return prev || nextCurrentProject.name || '';
        }
        return nextCurrentProject?.name || '';
      });
    },
    [currentProjectId, setProjectNameDraft, setWorkspaceInfo]
  );

  const mergeWorkspaceProjectData = useCallback(
    (payload) => {
      setWorkspaceInfo((info) => ({
        currentProject: payload.currentProject || info.currentProject,
        projects: Array.isArray(payload.projects)
          ? payload.projects
          : payload.currentProject
            ? info.projects.map((project) =>
                project.id === payload.currentProject.id
                  ? { ...project, ...payload.currentProject }
                  : project
              )
            : info.projects,
        versions: Array.isArray(payload.versions) ? payload.versions : info.versions,
      }));
      if (payload.currentProject?.name) {
        setProjectNameDraft(payload.currentProject.name);
      }
    },
    [setProjectNameDraft, setWorkspaceInfo]
  );

  return { syncWorkspaceMeta, mergeWorkspaceProjectData };
}
