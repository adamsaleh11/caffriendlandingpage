import Login from '@/components/crm/Login';
import { safeReturn } from '@/lib/contracts';
import '../crm.css';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{returnTo?:string}>}) {
  return <Login returnTo={safeReturn((await searchParams).returnTo)}/>;
}
