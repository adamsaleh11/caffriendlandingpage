import { safeReturn } from './contracts';
export class ApiError extends Error { constructor(public status:number,message:string){super(message);} }

async function parseApiResponse<T>(response: Response): Promise<T> {
  const text=await response.text();
  let result:{error?:string}|undefined;
  try{ result=text?JSON.parse(text) as {error?:string}:undefined; }
  catch{ throw new ApiError(response.ok?502:response.status,`The server returned an unexpected ${response.status} response for this request. Reload the page and try again.`); }
  if(!response.ok)throw new ApiError(response.status,result?.error || 'Please try again.');
  return result as T;
}

export async function api<T>(path:string, options:RequestInit={}, base:'crm'|'app'|'call'='crm'):Promise<T> {
  const response=await fetch(`/api/${base}/${path}`,{...options,headers:{'Content-Type':'application/json','X-Caffriend-Request':'1',...options.headers},cache:'no-store'});
  if(response.status===401){window.location.replace(`/login?returnTo=${encodeURIComponent(safeReturn(window.location.pathname))}`);throw new ApiError(401,'Sign in required');}
  // Not everything that answers this fetch is this app's API: a dev-server error
  // page, a proxy, or a stale build all answer in HTML. Parsing that as JSON
  // reports a syntax error instead of the status that actually explains it.
  return parseApiResponse<T>(response);
}

/**
 * Starts a provider consent round trip through this app's own API route.
 *
 * The route holds the backend origin and the session server-side, validates the
 * provider redirect, and records the pending flow in a sealed cookie. Calling
 * the backend from the browser instead meant a second origin to configure, a
 * bearer token in page script, and an unsealed pending cookie -- and when that
 * origin was not configured it silently fell back to production, which is why
 * connecting locally bounced to the login page.
 */
export async function startCrmOAuth(path: string): Promise<string> {
  const {redirect}=await api<{redirect:string}>(path.replace(/^\//,''),{method:'POST',body:'{}',headers:{'X-Idempotency-Key':crypto.randomUUID()}});
  return redirect;
}
