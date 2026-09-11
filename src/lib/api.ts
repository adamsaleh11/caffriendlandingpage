import { safeReturn } from './contracts';
export class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
export async function api<T>(path:string, options:RequestInit={}):Promise<T> {
  const response=await fetch(`/api/crm/${path}`,{...options,headers:{'Content-Type':'application/json','X-Caffriend-Request':'1',...options.headers},cache:'no-store'});
  if(response.status===401){window.location.replace(`/login?returnTo=${encodeURIComponent(safeReturn(window.location.pathname))}`);throw new ApiError(401,'Sign in required');}
  const result=await response.json();if(!response.ok)throw new ApiError(response.status,result.error || 'Please try again.');return result;
}
