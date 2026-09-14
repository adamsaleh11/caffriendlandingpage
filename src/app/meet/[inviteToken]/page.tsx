import Meeting from '@/components/meet/Meeting';
import { getSession } from '@/lib/session';
import '@livekit/components-styles';
import '@/app/calls/[id]/call.css';
import '../meet.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Coffee chat · Caffriend', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function Page({ params }: { params: Promise<{ inviteToken: string }> }) {
  /**
   * A signed-in member already told us their name when they signed up, and the
   * meetings they join from their own calendar are theirs. Asking again — in a
   * field they have to fill before the Join button will light up — is a stop on
   * the way into a call they are already late for. Guests still name themselves,
   * because nothing else knows who they are.
   */
  const session = await getSession();
  return <Meeting inviteToken={(await params).inviteToken} viewerName={session?.user.name ?? null} />;
}
