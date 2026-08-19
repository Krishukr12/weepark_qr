const ACCESS_KEY = 'weepark.access';
const LEGACY_REFRESH_KEY = 'weepark.refresh';

export const tokenStore = {
  getAccessToken(): string | null {
    return sessionStorage.getItem(ACCESS_KEY);
  },
  setAccessToken(accessToken: string): void {
    sessionStorage.setItem(ACCESS_KEY, accessToken);
  },
  clear(): void {
    sessionStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(LEGACY_REFRESH_KEY);
    localStorage.removeItem('weepark.activeEntry');
  },
};
