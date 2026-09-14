import Login from '@/components/crm/Login';
import { safeReturn } from '@/lib/contracts';
import '../crm.css';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{returnTo?:string}>}) {
  // The Google client id is public by design; its absence just leaves the button out.
  return <Login returnTo={safeReturn((await searchParams).returnTo)} googleClientId={process.env.GOOGLE_CLIENT_ID || undefined}/>;
}
