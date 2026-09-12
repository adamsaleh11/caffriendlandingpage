import EventDetail from '@/components/events/EventDetail';
import { getSession } from '@/lib/session';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{eventId:string}>}){const session=await getSession();return <EventDetail eventId={(await params).eventId} signedIn={Boolean(session)} displayName={session?.user.name||''}/>;}
