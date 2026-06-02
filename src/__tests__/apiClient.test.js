import { apiRequest } from '../api/apiClient';

describe('api request timeout protection', () => {
  let originalFetch;

  beforeEach(() => {
    jest.useFakeTimers();
    originalFetch = global.fetch;
    window.sessionStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  test('aborts a stalled SQL readiness request within the configured limit', async () => {
    global.fetch = jest.fn((_url, options) => {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener(
          'abort',
          () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          },
          { once: true }
        );
      });
    });

    const pendingRequest = apiRequest('/health?requireDatabase=1', { timeoutMs: 100 });
    jest.advanceTimersByTime(100);
    await expect(pendingRequest).rejects.toMatchObject({
      code: 'request_timeout',
      timeoutMs: 100,
    });
  });
});
