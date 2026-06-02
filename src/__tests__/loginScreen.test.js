import { renderToStaticMarkup } from 'react-dom/server';

import LoginScreen from '../features/auth/LoginScreen';

const users = [
  { id: 'kullanici1', name: 'Kullanıcı 1' },
  { id: 'kullanici2', name: 'Kullanıcı 2' },
];

function renderLogin(overrides = {}) {
  return renderToStaticMarkup(
    <LoginScreen
      users={users}
      loginForm={{ userId: 'kullanici1', password: '' }}
      loginBusy={false}
      loginError=""
      lockState={null}
      logoutReason=""
      onDismissLogoutReason={() => {}}
      onSelectQuickUser={() => {}}
      onUserIdChange={() => {}}
      onPasswordChange={() => {}}
      onLogin={() => {}}
      onForceKick={() => {}}
      onChooseDifferentUser={() => {}}
      {...overrides}
    />
  );
}

describe('LoginScreen', () => {
  test('renders quick accounts and a manual user id input', () => {
    const markup = renderLogin();

    expect(markup).toContain('Hızlı hesaplar');
    expect(markup).toContain('Kullanıcı ID');
    expect(markup).toContain('kullanici1');
    expect(markup).toContain('kullanici2');
  });

  test('renders the existing lock and forced takeover flow', () => {
    const markup = renderLogin({
      lockState: {
        userId: 'kullanici1',
        kickPending: true,
        waitSeconds: 0,
      },
    });

    expect(markup).toContain('Hesap başka bir cihazda açık');
    expect(markup).toContain('Zorla çıkar ve giriş yap');
    expect(markup).toContain('Farklı kullanıcı seç');
  });
});
