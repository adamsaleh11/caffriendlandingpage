import 'server-only';
import { redirect } from 'next/navigation';
import { getSession, type Session } from '@/lib/session';
import { safeReturn, type AppScreen } from '@/lib/contracts';

/**
 * Each consumer page guards itself rather than the layout doing it, because only the
 * page knows which screen it is — and signing in has to return you to the screen you
 * asked for, not to the CRM.
 */
export async function requireSession(screen: AppScreen): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?returnTo=${encodeURIComponent(safeReturn(`/${screen}`))}`);
  return session;
}
