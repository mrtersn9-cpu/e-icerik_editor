import { AlertCircle, KeyRound, LogIn, UserRound } from 'lucide-react';

import styles from './LoginScreen.module.css';

function accountName(users, userId) {
  return users.find((user) => user.id === userId)?.name || userId;
}

export default function LoginScreen({
  users,
  loginForm,
  loginBusy,
  loginError,
  lockState,
  logoutReason,
  onDismissLogoutReason,
  onUserIdChange,
  onPasswordChange,
  onRememberChange,
  onLogin,
  onForceKick,
  onChooseDifferentUser,
}) {
  return (
    <main className={styles.page}>
      {logoutReason && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="logout-title">
          <div className={styles.alertDialog}>
            <div className={styles.alertHeader}>
              <span className={styles.alertIcon}>
                <AlertCircle size={18} aria-hidden="true" />
              </span>
              <h2 id="logout-title">Oturum sonlandı</h2>
            </div>
            <div className={styles.alertMessage}>{logoutReason}</div>
            <button className={styles.primaryButton} type="button" onClick={onDismissLogoutReason}>
              <LogIn size={16} aria-hidden="true" />
              Giriş ekranına dön
            </button>
          </div>
        </div>
      )}

      <section className={styles.card}>
        <img className={styles.logo} src="/logo-light.svg" alt="E-İçerik Studio" />
        <h1 className={styles.srOnly}>Giriş yap</h1>

        {lockState ? (
          <div className={styles.lockCard}>
            <div className={styles.lockTitle}>
              <span>{accountName(users, lockState.userId)} başka bir cihazda açık</span>
            </div>
            <p>
              {lockState.kickPending
                ? (lockState.waitSeconds ?? 0) > 0
                  ? `Çıkış isteği gönderildi. ${lockState.waitSeconds} saniye sonra zorla çıkarabilirsiniz.`
                  : 'Bekleme tamamlandı. Artık zorla çıkış yaptırabilirsiniz.'
                : lockState.message || 'Bu kullanıcı aynı anda yalnızca tek cihazda editör açabilir.'}
            </p>
            {loginError && <div className={styles.errorMessage}>{loginError}</div>}
            <div className={styles.actions}>
              {lockState.kickPending && (lockState.waitSeconds ?? 1) === 0 && (
                <button className={styles.primaryButton} type="button" onClick={onForceKick} disabled={loginBusy}>
                  {loginBusy ? 'Çıkış isteniyor...' : 'Zorla çıkar ve giriş yap'}
                </button>
              )}
              <button className={styles.secondaryButton} type="button" onClick={onChooseDifferentUser}>
                Farklı kullanıcı seç
              </button>
            </div>
          </div>
        ) : (
          <form
            className={styles.fields}
            onSubmit={(event) => {
              event.preventDefault();
              if (!loginBusy) onLogin();
            }}
          >
            <label>
              <span>
                <UserRound size={14} aria-hidden="true" />
                Kullanıcı adı
              </span>
              <input
                list="editor-user-options"
                value={loginForm.userId}
                onChange={(event) => onUserIdChange(event.target.value.trim())}
                autoComplete="username"
                autoFocus
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
                <KeyRound size={14} aria-hidden="true" />
                Şifre
              </span>
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) => onPasswordChange(event.target.value)}
                autoComplete="current-password"
              />
            </label>

            <label className={styles.rememberRow}>
              <input
                type="checkbox"
                checked={!!loginForm.remember}
                onChange={(event) => onRememberChange(event.target.checked)}
              />
              <span>Beni hatırla (3 ay)</span>
            </label>

            {loginError && <div className={styles.errorMessage}>{loginError}</div>}

            <button className={styles.primaryButton} type="submit" disabled={loginBusy}>
              {loginBusy ? 'Giriş yapılıyor...' : 'Giriş yap'}
              <LogIn size={16} aria-hidden="true" />
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
