import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { safeReturn } from '@/lib/contracts';
import WorkspaceApp from '@/components/crm/WorkspaceApp';
import '../../crm.css';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{segments?:string[]}>}) {
  const segments=(await params).segments || [];
  const session=await getSession();
  if(!session) redirect(`/login?returnTo=${encodeURIComponent(safeReturn('/app'+(segments.length?'/'+segments.join('/'):'')))}`);
  return <WorkspaceApp key={segments.join('/')} segments={segments} user={session.user}/>;
}
