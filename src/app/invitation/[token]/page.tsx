import type { Metadata } from 'next';
import Invitation from '@/components/invitation/Invitation';
import { getSession } from '@/lib/session';

export const metadata: Metadata = {title:'Coffee chat invitation · Caffriend', referrer:'no-referrer'};

export default async function Page({params, searchParams}:{params:Promise<{token:string}>; searchParams:Promise<{intent?:string}>}) {
  const {token} = await params;
  const intent = (await searchParams).intent;
  // Someone already signed in skips the choice; the Google client id is public
  // by design, and its absence simply leaves the Google button out.
  const session = await getSession();
  return <Invitation token={token} signedIn={!!session}
    googleClientId={process.env.GOOGLE_CLIENT_ID || undefined}
    initialIntent={intent === 'accept' ? 'accept' : intent === 'decline' ? 'decline' : undefined} />;
}
