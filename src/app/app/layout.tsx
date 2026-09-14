import { getSession } from '@/lib/session';
import { backend, BackendError } from '@/lib/backend';
import type { Workspace } from '@/lib/contracts';
import { WorkspaceListProvider, type WorkspaceListState } from '@/components/crm/WorkspaceList';
import '../crm.css';
export const dynamic = 'force-dynamic';

/**
 * The workspace list belongs to the signed-in user, not to the route, so it is loaded
 * here rather than in the page: a layout survives a change of the child segment's value,
 * where the page beneath it is remounted. See `WorkspaceList` for the whole story.
 *
 * Signing out is not handled here. Only the page knows which section was asked for, and
 * sign-in has to return you to it, so the page keeps that redirect and this renders
 * nothing of its own when there is no session.
 */
export default async function AppLayout({children}:{children:React.ReactNode}) {
  const session = await getSession();
  if (!session) return <>{children}</>;
  let value: WorkspaceListState;
  try {
    const workspaces = await backend<Workspace[]>('/workspaces', {token: session.token});
    value = {workspaces: Array.isArray(workspaces) ? workspaces : [], problem: null};
  } catch (error) {
    // An outage must not read as "you have no workspaces", which would offer to create one.
    const status = error instanceof BackendError ? error.status : 503;
    const message = (error instanceof BackendError && typeof error.body?.error === 'string' && error.body.error)
      || (status === 403 ? 'You no longer have access to this workspace.' : 'The workspace service is unavailable.');
    value = {workspaces: null, problem: {status, message}};
  }
  return <WorkspaceListProvider value={value}>{children}</WorkspaceListProvider>;
}
