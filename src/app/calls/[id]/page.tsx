import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { safeReturn } from '@/lib/contracts';
import { CallScreen } from '@/components/call/CallScreen';
import './call.css';

export default async function Page({params}:{params:Promise<{id:string}>}) {
  const {id} = await params;
  // The guard returns you to this call, not to the calls list, so a sign-in
  // mid-way through joining does not land you somewhere you have to navigate out of.
  const session = await getSession();
  if (!session) redirect(`/login?returnTo=${encodeURIComponent(safeReturn(`/calls/${id}`))}`);
  return <CallScreen groupCallId={id} me={session.user.id} />;
}
