import { redirect } from 'next/navigation';
import EventMeeting from '@/components/events/EventMeeting';
import { getSession } from '@/lib/session';
import '@livekit/components-styles';
import '../../../meet/meet.css';
export const dynamic='force-dynamic';
export const metadata={title:'Live event · Caffriend',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({params}:{params:Promise<{eventId:string}>}){const {eventId}=await params;const session=await getSession();if(!session)redirect(`/login?returnTo=${encodeURIComponent(`/events/${eventId}/call`)}`);return <EventMeeting eventId={eventId} displayName={session.user.name}/>;}
