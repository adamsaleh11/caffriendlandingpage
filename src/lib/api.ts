import { safeReturn } from './contracts';
export class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
export async function api<T>(path:string, options:RequestInit={}):Promise<T> {
  const response=await fetch(`/api/crm/${path}`,{...options,headers:{'Content-Type':'application/json','X-Caffriend-Request':'1',...options.headers},cache:'no-store'});
  if(response.status===401){window.location.replace(`/login?returnTo=${encodeURIComponent(safeReturn(window.location.pathname))}`);throw new ApiError(401,'Sign in required');}
  // Not everything that answers this fetch is this app's API: a dev-server error
  // page, a proxy, or a stale build all answer in HTML. Parsing that as JSON
  // reports a syntax error instead of the status that actually explains it.
  const text=await response.text();
  let result:{error?:string}|undefined;
  try{ result=text?JSON.parse(text) as {error?:string}:undefined; }
  catch{ throw new ApiError(response.ok?502:response.status,`The server returned an unexpected ${response.status} response for this request. Reload the page and try again.`); }
  if(!response.ok)throw new ApiError(response.status,result?.error || 'Please try again.');
  return result as T;
}
