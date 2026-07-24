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
      loginForm={{ userId: 'kullanici1', password: '', remember: false }}
      loginBusy={false}
      loginError=""
      lockState={null}
      logoutReason=""
      onDismissLogoutReason={() => {}}
      onUserIdChange={() => {}}
      onPasswordChange={() => {}}
      onRememberChange={() => {}}
      onLogin={() => {}}
      onForceKick={() => {}}
      onChooseDifferentUser={() => {}}
      {...overrides}
    />
  );
}

describe('LoginScreen', () => {
  test('renders a plain username/password form with a remember-me checkbox', () => {
    const markup = renderLogin();

    expect(markup).toContain('Kullanıcı adı');
    expect(markup).toContain('Şifre');
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain('Beni hatırla (3 ay)');
    expect(markup).toContain('kullanici1');
    expect(markup).toContain('kullanici2');
  });

  test('marks the remember-me checkbox as checked when loginForm.remember is true', () => {
    const markup = renderLogin({ loginForm: { userId: 'kullanici1', password: '', remember: true } });

    expect(markup).toContain('checked=""');
  });

  test('renders the existing lock and forced takeover flow', () => {
    const markup = renderLogin({
      lockState: {
        userId: 'kullanici1',
        kickPending: true,
        waitSeconds: 0,
      },
    });

    expect(markup).toContain('başka bir cihazda açık');
    expect(markup).toContain('Zorla çıkar ve giriş yap');
    expect(markup).toContain('Farklı kullanıcı seç');
  });
});
