import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  KeyRound,
  LogIn,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';

import styles from './LoginScreen.module.css';

function accountName(users, userId) {
  return users.find((user) => user.id === userId)?.name || userId;
}

/* Miniature editor canvas shown in the left showcase */
function StudioPreview() {
  return (
    <div className={styles.studioPreview}>
      <div className={styles.previewCard}>
        {/* scene rail */}
        <div className={styles.previewRail}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={styles.previewScene}
              style={{
                borderColor: i === 1 ? '#38bdf8' : 'rgba(148,163,184,.28)',
                background: i === 1 ? 'rgba(56,189,248,.18)' : 'rgba(255,255,255,.05)',
              }}
            />
          ))}
        </div>
        {/* canvas */}
        <div className={styles.previewCanvas}>
          <div className={styles.previewSlide}>
            <div className={styles.previewSlideHeader}>
              <div style={{ width: '62%', height: 8, borderRadius: 999, background: 'rgba(255,255,255,.85)' }} />
            </div>
            <div className={styles.previewSlideOptions}>
              {[0, 1, 2, 3].map((i) => {
                const correct = i === 0;
                return (
                  <div
                    key={i}
                    className={styles.previewOption}
                    style={{
                      borderColor: correct ? '#16a34a' : '#e2e8f0',
                      background: correct ? '#f0fdf4' : '#fff',
                    }}
                  >
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                      display: 'grid', placeItems: 'center',
                      border: `1.5px solid ${correct ? '#16a34a' : '#cbd5e1'}`,
                      color: '#16a34a', fontSize: 9, fontWeight: 900,
                    }}>{correct ? '✓' : ''}</span>
                    <span style={{ width: i % 2 ? '52%' : '68%', height: 7, borderRadius: 999, background: correct ? '#bbf7d0' : '#e2e8f0' }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {/* floating chips */}
      <span className={`${styles.previewChip} ${styles.previewChipA}`}>
        <span style={{ width: 18, height: 18, borderRadius: 5, display: 'grid', placeItems: 'center', background: 'rgba(125,211,252,.2)', fontSize: 9 }}>↕</span>
        Sürükle-Bırak
      </span>
      <span className={`${styles.previewChip} ${styles.previewChipB}`}>
        <span style={{ width: 18, height: 18, borderRadius: 5, display: 'grid', placeItems: 'center', background: 'rgba(134,239,172,.2)', fontSize: 9 }}>▦</span>
        SCORM 1.2
      </span>
    </div>
  );
}

export default function LoginScreen({
  users,
  loginForm,
  loginBusy,
  loginError,
  lockState,
  logoutReason,
  onDismissLogoutReason,
  onSelectQuickUser,
  onUserIdChange,
  onPasswordChange,
  onLogin,
  onForceKick,
  onChooseDifferentUser,
}) {
  const selectedUserName = accountName(users, loginForm.userId);

  return (
    <main className={styles.page}>
      {/* ambient aurora blobs */}
      <div className={`${styles.aurora} ${styles.aurora1}`} aria-hidden="true" />
      <div className={`${styles.aurora} ${styles.aurora2}`} aria-hidden="true" />
      <div className={`${styles.aurora} ${styles.aurora3}`} aria-hidden="true" />

      {logoutReason && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="logout-title">
          <div className={styles.alertDialog}>
            <div className={styles.alertHeader}>
              <span className={styles.alertIcon}>
                <AlertCircle size={20} aria-hidden="true" />
              </span>
              <div>
                <h2 id="logout-title">Oturum sonlandı</h2>
                <p>Sunucudan gelen oturum bilgisi</p>
              </div>
            </div>
            <div className={styles.alertMessage}>{logoutReason}</div>
            <button className={styles.primaryButton} type="button" onClick={onDismissLogoutReason}>
              <LogIn size={17} aria-hidden="true" />
              Giriş ekranına dön
            </button>
          </div>
        </div>
      )}

      <section className={styles.shell}>
        {/* ── left showcase ── */}
        <aside className={styles.intro}>
          <div className={styles.introGlow} aria-hidden="true" />
          <div className={styles.introGlowBottom} aria-hidden="true" />

          <div className={styles.brandRow}>
            <span className={styles.logoMark}>
              <img className={styles.logo} src="/logo-light.svg" alt="E-İçerik Studio" />
            </span>
            <span className={styles.secureBadge}>
              <ShieldCheck size={15} aria-hidden="true" />
              Yetkili editör alanı
            </span>
          </div>

          <div className={styles.introCopy}>
            <span className={styles.kicker}>Premium İçerik Motoru</span>
            <h1>
              Ders içeriği üretimini{' '}
              <em>gelecek nesil</em>{' '}
              bir deneyime taşıyın
            </h1>
            <p>
              Sürükle-bırak etkinliklerden çok katmanlı öğrenme akışlarına kadar,
              tüm üretim sürecini tek bir yaratım altyapısında yönetin.
            </p>
          </div>

          <StudioPreview />

          <div className={styles.signalGrid} aria-label="Özellikler">
            {[
              { title: 'Canlı sahne akışı', desc: 'Düzenleme ve önizleme birlikte', color: '#7dd3fc' },
              { title: 'Akıllı yapı',       desc: 'Nesne, tetikleyici, cevap mantığı', color: '#c4b5fd' },
              { title: 'Yayın hazır',       desc: 'Ölçeklenebilir çıktı sistemi', color: '#86efac' },
            ].map(({ title, desc, color }) => (
              <div key={title}>
                <div className={styles.signalGridIcon} />
                <strong>{title}</strong>
                <span style={{ color: '#a9c8dc' }}>{desc}</span>
              </div>
            ))}
          </div>

          <div className={styles.note}>
            <CheckCircle2 size={17} aria-hidden="true" />
            <span>Eğitim içerikleri artık yalnızca hazırlanmaz; tasarlanır, yönetilir ve yayınlanır.</span>
          </div>
        </aside>

        {/* ── right form panel ── */}
        <section className={styles.formPanel}>
          <header className={styles.formHeader}>
            <span className={styles.eyebrow}>E-İçerik Studio</span>
            <h2>{lockState ? 'Hesap başka bir cihazda açık' : 'Stüdyoya güvenli giriş yapın'}</h2>
            <p>
              {lockState
                ? 'Diğer oturum kapanırsa giriş otomatik tamamlanır. Gerekirse çıkış isteği gönderebilirsiniz.'
                : 'Hesabınızı seçin, çalışma alanınızı açın ve üretime kaldığınız yerden devam edin.'}
            </p>
          </header>

          {lockState ? (
            <div className={styles.lockCard}>
              <div className={styles.lockTitle}>
                <Clock3 size={18} aria-hidden="true" />
                <span>{accountName(users, lockState.userId)} başka bir cihazda açık.</span>
              </div>
              <p>
                {lockState.kickPending
                  ? (lockState.waitSeconds ?? 0) > 0
                    ? `Çıkış isteği gönderildi. ${lockState.waitSeconds} saniye sonra zorla çıkarabilirsiniz.`
                    : 'Bekleme tamamlandı. Artık zorla çıkış yaptırabilirsiniz.'
                  : lockState.message || 'Bu kullanıcı aynı anda yalnızca tek cihazda editör açabilir.'}
              </p>
              {lockState.session?.lastSeenAt && (
                <small>Son aktif: {new Date(lockState.session.lastSeenAt).toLocaleString('tr-TR')}</small>
              )}
              {lockState.kickPending && (lockState.waitSeconds ?? 1) > 0 && (
                <button className={styles.quietLink} type="button" onClick={onForceKick} disabled={loginBusy}>
                  Beklemeden zorla çıkar
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={styles.sessionPreview}>
                <span className={styles.previewAvatar}>{selectedUserName.trim().charAt(0).toUpperCase()}</span>
                <div>
                  <span>Seçili hesap</span>
                  <strong>{selectedUserName}</strong>
                </div>
                <span className={styles.sessionBadge}>
                  <span className={styles.sessionBadgeDot} />
                  Hazır
                </span>
              </div>

              <div className={styles.quickSection}>
                <div className={styles.sectionLabel}>
                  <UsersRound size={15} aria-hidden="true" />
                  Hızlı hesaplar
                </div>
                <div className={styles.quickGrid}>
                  {users.map((user) => {
                    const active = loginForm.userId === user.id;
                    return (
                      <button
                        key={user.id}
                        type="button"
                        className={`${styles.accountButton} ${active ? styles.accountButtonActive : ''}`}
                        onClick={() => onSelectQuickUser(user.id)}
                        aria-pressed={active}
                      >
                        <span className={styles.avatar}>{user.name.trim().charAt(0).toUpperCase()}</span>
                        <span>
                          <strong>{user.name}</strong>
                          <small>{user.id}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.fields}>
                <label>
                  <span>
                    <UserRound size={15} aria-hidden="true" />
                    Kullanıcı ID
                  </span>
                  <input
                    list="editor-user-options"
                    value={loginForm.userId}
                    onChange={(event) => onUserIdChange(event.target.value.trim())}
                    autoComplete="username"
                  />
                  <datalist id="editor-user-options">
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </datalist>
                </label>
                <label>
                  <span>
                    <KeyRound size={15} aria-hidden="true" />
                    Şifre
                  </span>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !loginBusy) onLogin();
                    }}
                    autoComplete="current-password"
                  />
                </label>
              </div>
            </>
          )}

          {loginError && <div className={styles.errorMessage}>{loginError}</div>}

          {lockState ? (
            <div className={styles.actions}>
              {lockState.kickPending && (lockState.waitSeconds ?? 1) === 0 && (
                <button className={styles.warningButton} type="button" onClick={onForceKick} disabled={loginBusy}>
                  {loginBusy ? 'Çıkış isteniyor...' : 'Zorla çıkar ve giriş yap'}
                </button>
              )}
              <button className={styles.secondaryButton} type="button" onClick={onChooseDifferentUser}>
                Farklı kullanıcı seç
              </button>
            </div>
          ) : (
            <>
              <button className={styles.primaryButton} type="button" onClick={onLogin} disabled={loginBusy}>
                {loginBusy ? 'Giriş yapılıyor...' : 'Çalışma alanını aç'}
                <ArrowRight size={17} aria-hidden="true" />
              </button>

              <div className={styles.trustRow}>
                {[
                  [<ShieldCheck size={13} aria-hidden="true" />, 'Şifreli bağlantı'],
                  [<UserRound size={13} aria-hidden="true" />, 'Tek oturum'],
                  [<CheckCircle2 size={13} aria-hidden="true" />, 'TTKB uyumlu'],
                ].map(([icon, label]) => (
                  <span key={label}>{icon}{label}</span>
                ))}
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
