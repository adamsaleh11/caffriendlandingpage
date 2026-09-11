import Meeting from '@/components/meet/Meeting';
import '@livekit/components-styles';
import '../meet.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Coffee chat · Caffriend', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function Page({ params }: { params: Promise<{ inviteToken: string }> }) {
  return <Meeting inviteToken={(await params).inviteToken} />;
}
