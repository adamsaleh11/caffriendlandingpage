import { redirect } from 'next/navigation';
import HostEventForm from '@/components/events/HostEventForm';
import { getSession } from '@/lib/session';
export const dynamic='force-dynamic';
export default async function Page(){if(!await getSession())redirect('/login?returnTo=%2Fevents%2Fnew');return <HostEventForm/>;}
