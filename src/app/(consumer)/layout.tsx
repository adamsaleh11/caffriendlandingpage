import { getSession } from '@/lib/session';
import { backend } from '@/lib/backend';
import AppShell from '@/components/app/AppShell';
import type { Workspace } from '@/lib/contracts';
import '../crm.css';
export const dynamic = 'force-dynamic';

/**
 * The CRM sidebar is present on these screens too, so the workspace is always one
 * click away. Loading it is best-effort: if the workspace service is unavailable the
 * sidebar still renders with a link to /app, and these screens keep working.
 */
export default async function ConsumerLayout({children}:{children:React.ReactNode}) {
  const session = await getSession();
  let workspaces: Workspace[] = [];
  if (session) {
    try { workspaces = await backend<Workspace[]>('/workspaces', {token: session.token}); }
    catch { workspaces = []; }
  }
  // Each page guards itself, so sign-in can return to the screen that was asked for.
  return <AppShell workspaces={Array.isArray(workspaces) ? workspaces : []}>{children}</AppShell>;
}
