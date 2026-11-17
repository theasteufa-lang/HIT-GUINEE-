let inMemorySessionToken: string | null = null;

export function setSessionToken(token: string | null) {
  inMemorySessionToken = token;
}

export function getSessionToken(): string | null {
  return inMemorySessionToken;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (inMemorySessionToken) {
    headers['Authorization'] = `Bearer ${inMemorySessionToken}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Une erreur serveur est survenue.') as Error & {
      status?: number;
      requiresBiometric?: boolean;
    };
    err.status = res.status;
    err.requiresBiometric = Boolean(data.requiresBiometric);
    throw err;
  }

  return data as T;
}

export function formatFcfa(amount: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(amount))} FCFA`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
