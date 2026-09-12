import { safeReturn } from './contracts';
export class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
const crmBackendOrigin = process.env.NEXT_PUBLIC_CAFFRIEND_API_ORIGIN || 'https://api.caffriend.com';
const directPendingCookie = 'caffriend_direct_calendar_pending';

async function parseApiResponse<T>(response: Response): Promise<T> {
  const text=await response.text();
  let result:{error?:string}|undefined;
  try{ result=text?JSON.parse(text) as {error?:string}:undefined; }
  catch{ throw new ApiError(response.ok?502:response.status,`The server returned an unexpected ${response.status} response for this request. Reload the page and try again.`); }
  if(!response.ok)throw new ApiError(response.status,result?.error || 'Please try again.');
  return result as T;
}

export async function api<T>(path:string, options:RequestInit={}):Promise<T> {
  const response=await fetch(`/api/crm/${path}`,{...options,headers:{'Content-Type':'application/json','X-Caffriend-Request':'1',...options.headers},cache:'no-store'});
  if(response.status===401){window.location.replace(`/login?returnTo=${encodeURIComponent(safeReturn(window.location.pathname))}`);throw new ApiError(401,'Sign in required');}
  // Not everything that answers this fetch is this app's API: a dev-server error
  // page, a proxy, or a stale build all answer in HTML. Parsing that as JSON
  // reports a syntax error instead of the status that actually explains it.
  return parseApiResponse<T>(response);
}

export async function crmBackendApi<T>(path:string, options:RequestInit={}):Promise<T> {
  const response=await fetch(new URL(path, crmBackendOrigin),{...options,headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},cache:'no-store',credentials:'include'});
  if(response.status===401){window.location.replace(`/login?returnTo=${encodeURIComponent(safeReturn(window.location.pathname))}`);throw new ApiError(401,'Sign in required');}
  return parseApiResponse<T>(response);
}

async function sessionToken() {
  const response=await fetch('/api/session/token',{method:'POST',headers:{'Content-Type':'application/json','X-Caffriend-Request':'1'},cache:'no-store'});
  if(response.status===401){window.location.replace(`/login?returnTo=${encodeURIComponent(safeReturn(window.location.pathname))}`);throw new ApiError(401,'Sign in required');}
  const result=await parseApiResponse<{token:string}>(response);
  return result.token;
}

async function sha256(value:string) {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

export async function startCrmOAuth(path:string, provider:string, workspaceId:string):Promise<string> {
  const token=await sessionToken();
  const {redirect}=await crmBackendApi<{redirect:string}>(path,{method:'POST',headers:{Authorization:`Bearer ${token}`}});
  const state=new URL(redirect).searchParams.get('state');
  if(state){
    const flow={provider,workspaceId,stateHash:await sha256(state),created:Date.now()};
    const secure=window.location.protocol==='https:'?'; Secure':'';
    document.cookie=`${directPendingCookie}=${encodeURIComponent(JSON.stringify({flows:[flow]}))}; Max-Age=300; Path=/; SameSite=Lax${secure}`;
  }
  return redirect;
}
