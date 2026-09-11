import 'server-only';
export class BackendError extends Error {
  constructor(public status: number) {super('Backend request failed');}
}
export async function backend<T>(path: string, options: {token?: string; method?: string; body?: unknown; key?: string} = {}): Promise<T> {
  const origin = process.env.CAFFRIEND_API_ORIGIN;
  if (!origin) throw new BackendError(503);
  const url = new URL(origin);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) || url.username || url.password || url.pathname !== '/') throw new BackendError(503);
  try {
    const response = await fetch(new URL(path, url.origin), {
      method: options.method || 'GET', cache:'no-store', redirect:'manual', signal:AbortSignal.timeout(15000),
      headers: {Accept:'application/json', ...(options.token ? {Authorization:`Bearer ${options.token}`} : {}), ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.key ? {'Idempotency-Key':options.key} : {})},
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) throw new BackendError(response.status >= 300 && response.status < 400 ? 502 : response.status);
    return await response.json() as T;
  } catch(error) { if(error instanceof BackendError) throw error; throw new BackendError(503); }
}
