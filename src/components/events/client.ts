import { ApiError } from '@/lib/api';

export async function eventsApi<T>(path='', options:RequestInit={}):Promise<T> {
  const response=await fetch(`/api/events${path?`/${path}`:''}`,{...options,cache:'no-store',headers:{'Content-Type':'application/json','X-Caffriend-Request':'1',...options.headers}});
  if (response.status===401) throw new ApiError(401,'Sign in required.');
  const result=await response.json().catch(()=>({}));
  if (!response.ok) throw new ApiError(response.status,result.error||'Please try again.');
  return result;
}

export const problemMessage=(problem:unknown)=>problem instanceof ApiError?problem.message:'This could not be completed right now.';
