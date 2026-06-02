/**
 * Çalışma alanı yerel önbelleği (stale-while-revalidate).
 *
 * Amaç: yavaş internette açılışı hızlandırmak. Son başarılı çalışma alanı
 * tarayıcıda (localStorage) saklanır; açılışta ANINDA gösterilir, arka planda
 * sunucudan tazelenir.
 *
 * Doğruluk: önbellek, kullanıcının EN SON kaydettiği hâli yansıtır (her başarılı
 * yükleme ve kayıttan sonra güncellenir). Bu yüzden aynı cihazda hep son işi
 * görünür; yalnızca sunucuda daha YENİ bir sürüm varsa (başka cihaz) arka planda
 * o sürümle değiştirilir. Kullanıcıya/projeye özel anahtarlanır.
 */
const PREFIX = 'eic:wscache:';

function keyFor(userId) {
  return `${PREFIX}${String(userId || '').trim()}`;
}

export function readWorkspaceCache(userId) {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.workspace || !parsed.workspace.state) return null;
    return parsed; // { updatedAt, projectId, workspace, cachedAt }
  } catch {
    return null;
  }
}

export function writeWorkspaceCache(userId, workspace) {
  if (!userId || typeof window === 'undefined' || !workspace || !workspace.state) return;
  try {
    const entry = {
      updatedAt: workspace.updatedAt || null,
      projectId: workspace.currentProject?.id || null,
      workspace,
      cachedAt: Date.now(),
    };
    window.localStorage.setItem(keyFor(userId), JSON.stringify(entry));
  } catch {
    // Kota aşımı (büyük çalışma alanı) vb. — önbellek sessizce atlanır;
    // uygulama mevcut (sunucudan yükleme) davranışına döner.
    try {
      window.localStorage.removeItem(keyFor(userId));
    } catch {
      /* yok say */
    }
  }
}

export function clearWorkspaceCache(userId) {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(keyFor(userId));
  } catch {
    /* yok say */
  }
}
