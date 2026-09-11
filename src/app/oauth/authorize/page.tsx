import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession, readSealed, consentCookie } from '@/lib/session';
import { backend, BackendError } from '@/lib/backend';
import { scopeExplanations, immediateScopes, type ConsentDetails } from '@/lib/contracts';
import '../../crm.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Authorize access — Caffriend', robots: {index:false, follow:false}, referrer: 'no-referrer' as const };

const problems: Record<string,string> = {
  expired: 'This authorization request has expired. Start again from the application that sent you here.',
  invalid: 'This authorization request is no longer valid. Start again from the application that sent you here.',
  blocked: 'That request could not be verified. Start again from the application that sent you here.',
  failed: 'Authorization could not be completed. Start again from the application that sent you here.',
  cancelled: 'Authorization was cancelled. You can close this page.',
};

function Exit({title, message}:{title:string;message:string}) {
  return <main className="crm center"><section className="card state"><h1>{title}</h1><p role="alert">{message}</p><Link className="text-link" href="/app">Go to your workspace</Link></section></main>;
}

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query = await searchParams;
  const problem = typeof query.problem === 'string' ? query.problem : undefined;
  const incoming = typeof query.request === 'string' ? query.request : undefined;

  // Capture the opaque request into protected short-lived state, then return to a clean consent
  // URL, so the request parameter leaves the browser's address bar and history before anything
  // renders. Cookies can only be written by the route handler, hence the hop.
  if (incoming) redirect(`/api/consent?request=${encodeURIComponent(incoming)}`);
  if (problem) return <Exit title="Authorization stopped" message={problems[problem] ?? problems.invalid}/>;

  const session = await getSession();
  if (!session) redirect('/login');
  const captured = await readSealed<{request:string;csrf:string}>(consentCookie);
  if (!captured?.request) return <Exit title="Authorization stopped" message={problems.expired}/>;

  let details: ConsentDetails;
  try {
    details = await backend<ConsentDetails>(`/oauth/consent?request=${encodeURIComponent(captured.request)}`, {token: session.token});
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    return <Exit title="Authorization stopped" message={status === 404 || status === 400 ? problems.expired : 'Authorization is unavailable right now. Start again from the application that sent you here.'}/>;
  }

  const workspace = details.workspaces?.[0];
  if (!workspace) return <Exit title="Access unavailable" message="This application cannot be given access with your current workspace membership. Start again from the application that sent you here."/>;

  const scopes = details.scopes ?? [];
  const offline = details.offlineRequested === true || scopes.includes('offline_access');
  // Required additive backend follow-up: verified client identity. Until it is returned we fail
  // closed rather than trusting a name from the request.
  if (!details.client?.name) return <Exit title="Requesting application unavailable" message="Caffriend cannot verify which application is asking for access, so this request cannot be approved. Start again from the application that sent you here."/>;

  return <main className="crm center"><section className="card consent">
    <p className="eyebrow">MCP authorization</p>
    <h1>Allow {details.client.name} to use Caffriend?</h1>
    <p>Verified application ID <code>{details.client.id}</code> is requesting access to one of your workspaces.</p>
    <form method="post" action="/api/consent">
      <input type="hidden" name="workspaceId" value={workspace.id}/>
      <input type="hidden" name="csrf" value={captured.csrf}/>
      <h2>Workspace</h2>
      <p className="confirm-workspace">{workspace.name}</p>
      <h2>Requested access</h2>
      <ul className="scopes">{scopes.map(scope => <li key={scope}>
        <code>{scope}</code>
        <span>{scopeExplanations[scope] ?? 'Caffriend cannot explain this request. Approve it only if you expect it.'}</span>
        <span className="scope-kind">{immediateScopes.includes(scope) ? 'Applied immediately' : scope.endsWith(':write') || scope === 'proposals:write' ? 'Proposed for your approval' : 'Read only'}</span>
      </li>)}</ul>
      {(details.warnings ?? []).length > 0 && <div className="warnings" role="note"><h2>Before you allow</h2><ul>{details.warnings!.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
      {offline && <label className="checkbox"><input type="checkbox" name="offlineConsent" required/>Allow continued access when I am not using {details.client.name}.</label>}
      <div className="actions">
        <button name="decision" value="allow">Allow access</button>
        <button name="decision" value="cancel" className="secondary" formNoValidate>Cancel</button>
      </div>
    </form>
  </section></main>;
}
