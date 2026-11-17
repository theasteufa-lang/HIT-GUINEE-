import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'steufa_encrypted_session_token';
const DEFAULT_API_BASE = 'https://ais-dev-k4ssi6rmnpnzpzt7qm4wvp-227196533962.europe-west2.run.app';

export async function saveEncryptedSession(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getEncryptedSession(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function clearEncryptedSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function authenticateHardwareBiometric(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!hasHardware || !isEnrolled) {
    return false;
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Confirmez votre identité biométrique Steufa',
    cancelLabel: 'Annuler',
    disableDeviceFallback: false,
  });
  return result.success;
}

export async function mobileApi<T>(
  path: string,
  options: RequestInit = {},
  baseUrl = DEFAULT_API_BASE
): Promise<T> {
  const token = await getEncryptedSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Erreur serveur');
  }
  return data as T;
}

export function formatFcfaMobile(value: number): string {
  return `${Math.round(value).toLocaleString('fr-FR')} FCFA`;
}
