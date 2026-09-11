import http from 'node:http';
export const workspace = {id:'11111111-1111-4111-8111-111111111111',name:'Studio'};
const connectionId = '33333333-3333-4333-8333-333333333333';
export const meetingId = '44444444-4444-4444-8444-444444444444';
const inviteToken = 'a'.repeat(43);
const baseMeeting = () => ({
  id: meetingId, workspaceId: workspace.id,
  purpose:'Coffee with Alex', startsAt:'2026-09-12T19:00:00.000Z', endsAt:'2026-09-12T19:30:00.000Z',
  timezone:'America/Toronto', status:'CONFIRMED', provider:'GOOGLE',
  joinUrl:`https://caffriend.com/meet/${inviteToken}`,
  physicalLocation:null, agenda:'Intro chat', engagementId:null,
  organizerId:'member-1', connectionId, errorCode:null,
  createdAt:'2026-09-01T10:00:00.000Z', updatedAt:'2026-09-01T10:00:00.000Z',
});
const auditRows = () => [
  {id:'audit-1',workspaceId:workspace.id,createdAt:'2026-09-02T10:00:00.000Z',actorType:'MEMBER',actorMemberId:'member-1',actorAgentId:null,action:'meeting.confirmed',targetType:'Meeting',targetId:meetingId,approvalId:null},
  {id:'audit-2',workspaceId:workspace.id,createdAt:'2026-09-03T10:00:00.000Z',actorType:'MEMBER',actorMemberId:'member-1',actorAgentId:null,action:'meeting.join_link_issued',targetType:'Meeting',targetId:meetingId,approvalId:null},
  {id:'audit-3',workspaceId:workspace.id,createdAt:'2026-09-04T10:00:00.000Z',actorType:'AGENT',actorMemberId:null,actorAgentId:'agent-9',action:'person.updated',targetType:'Person',targetId:'person-7',approvalId:null},
];
let state = {};
const clone = value => JSON.parse(JSON.stringify(value));

const defaultConnections = () => state.connections ?? [];
const defaultStatus = () => state.status ?? {GOOGLE:{configured:true},MICROSOFT:{configured:true}};

http.createServer(async (req,res) => {
  const url = new URL(req.url, 'http://localhost');
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const send = (data,status=200) => {res.writeHead(status, {'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  const path = url.pathname;
  if(path === '/__state') { if(req.method==='POST'){state=clone(body);state.calls=[];} return send(state); }
  if(path === '/meetings/join/token') {
    if(state.allowJoin) return send({token:'test-livekit-token',url:'wss://livekit.test'});
    if(state.joinClosed) return send({message:'Meeting is not open for joining'},403);
    return send({message:'Invitation unavailable'},404);
  }
  if(path === '/meetings/join/resolve') {
    if(state.invitationUnavailable || body.token !== 'a'.repeat(43)) return send({message:'Invitation unavailable'},404);
    if(state.meetingFailure) return send({message:'PRIVATE_CRM_SENTINEL'},503);
    return send({purpose:'Coffee with Alex',startsAt:'2026-09-12T19:00:00.000Z',endsAt:'2026-09-12T19:30:00.000Z',timezone:'America/Toronto',requiresDisplayName:true,requiresTermsAcceptance:true,workspaceId:'PRIVATE_CRM_SENTINEL',notes:'PRIVATE_CRM_SENTINEL'});
  }
  if(path==='/user/login') {
    if(body.password !== 'correct') return send({message:'Password is incorrect'},400);
    const token = 'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:'user-1',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.test-signature';
    return send({success:true,code:200,data:{token,user:{id:'user-1',firstName:'Alex',email:body.email}}});
  }
  if(state.unauthorized) return send({message:'Unauthorized'},401);
  if(state.forbidden && path.startsWith('/workspaces')) return send({message:'Forbidden'},403);
  if(state.workspacesFail && path==='/workspaces') return send({message:'Unavailable'},503);
  if(!req.headers.authorization) return send({},401);
  (state.calls ??= []).push({method:req.method,path,key:req.headers['idempotency-key'] ?? null,body});

  if(path==='/workspaces') { if(req.method==='POST'){state.workspaces=[{...workspace,name:body.name}];return send(state.workspaces[0]);} return send(state.workspaces ?? [workspace]); }
  if(path===`/workspaces/${workspace.id}`) return send(workspace);

  // OAuth consent
  if(path==='/oauth/consent') {
    if(req.method==='GET') {
      if(url.searchParams.get('request')!=='opaque-request') return send({message:'Expired'},404);
      return send(state.consent ?? {
        client:{id:'client-abc',name:'Notes Assistant'},
        scopes:['notes:write','proposals:write','people:read'],
        warnings:['This application can add notes to your workspace without further approval.'],
        workspaces:[workspace],
        offlineRequested:false,
      });
    }
    if(!body.request || !body.workspaceId) return send({message:'Invalid'},400);
    if(state.consentFails) return send({message:'Invalid'},400);
    return send({redirect:`https://client.example.com/callback?state=xyz${body.approved?'&code=authcode-secret':'&error=access_denied'}`});
  }

  const meetingBase = `/workspaces/${workspace.id}/meetings`;
  state.meeting ??= baseMeeting();
  if(path === `/workspaces/${workspace.id}/audit-events`) {
    const allowed = ['cursor','limit','search','pipelineId'];
    if([...url.searchParams.keys()].some(k=>!allowed.includes(k))) return send({message:'Unknown input field'},400);
    if(state.auditForbidden) return send({message:'Forbidden'},403);
    const rows = state.audit ?? auditRows();
    // One row per page, so the frontend must follow nextCursor to see them all.
    const cursor = url.searchParams.get('cursor');
    const start = cursor ? rows.findIndex(row=>row.id===cursor)+1 : 0;
    const items = rows.slice(start, start+1);
    const consumed = start + items.length;
    return send({items, nextCursor: consumed < rows.length ? items[items.length-1].id : null});
  }
  if(path === `${meetingBase}/${meetingId}`) {
    if(state.meetingMissing) return send({message:'Resource not found'},404);
    return send(state.meeting);
  }
  if(path === `${meetingBase}/${meetingId}/join-link`) {
    if(state.joinLinkFails) return send({message:'Resource not found'},404);
    return send({joinUrl:state.meeting.joinUrl});
  }
  if(path === `${meetingBase}/${meetingId}/reschedule`) {
    if(state.rescheduleConflict) return send({message:'Meeting is busy'},409);
    if(state.rescheduleFails) return send({message:'Unavailable'},503);
    state.meeting = {...state.meeting, startsAt:body.startsAt, endsAt:body.endsAt, timezone:body.timezone};
    return send(state.meeting);
  }
  if(path === `${meetingBase}/${meetingId}/cancel`) {
    if(state.cancelFails) return send({message:'Unavailable'},503);
    // A 200 carrying a failure status must not be read as success.
    state.meeting = {...state.meeting, status: state.cancelFailedStatus ? 'CANCEL_FAILED' : 'CANCELLED'};
    return send(state.meeting);
  }
  const calendarBase = `/workspaces/${workspace.id}/calendar-connections`;
  if(path===`${calendarBase}/status`) return send(defaultStatus());
  if(path===calendarBase) {
    // Mirrors the backend exactly: cursor pagination, and unknown query fields are rejected.
    const allowed = ['cursor','limit','search','pipelineId'];
    if([...url.searchParams.keys()].some(k=>!allowed.includes(k))) return send({message:'Unknown input field'},400);
    const rows = defaultConnections();
    const cursor = url.searchParams.get('cursor');
    // One row per page, so the frontend must follow nextCursor to see them all.
    const start = cursor ? rows.findIndex(row=>row.id===cursor)+1 : 0;
    const items = rows.slice(start, start+1);
    const consumed = start + items.length;
    return send({items, nextCursor: consumed < rows.length ? items[items.length-1].id : null});
  }
  if(path.endsWith('/connect')) {
    const provider = path.split('/').at(-2);
    if(state.connectFails) return send({message:'Unavailable'},503);
    const host = provider==='GOOGLE' ? 'accounts.google.com/o/oauth2/v2/auth' : 'login.microsoftonline.com/common/oauth2/v2.0/authorize';
    return send({redirect:`https://${host}?client_id=test&state=state-${provider}&redirect_uri=http%3A%2F%2Flocalhost%3A3100%2Fcrm-calendar%2Fcallback%2F${provider}`});
  }
  if(path===`${calendarBase}/${connectionId}/calendars`) return send({data:[{id:'primary',name:'Alex — Work',writable:true},{id:'readonly',name:'Holidays',writable:false}]});
  if(path===`${calendarBase}/${connectionId}/select`) {
    if(!req.headers['idempotency-key']) return send({message:'Idempotency-Key required'},400);
    state.connections=[{...state.connections[0],status:'CONNECTED',calendarId:body.calendarId,calendarName:'Alex — Work'}];
    return send(state.connections[0]);
  }
  if(path===`${calendarBase}/${connectionId}/disconnect`) {
    if(!req.headers['idempotency-key']) return send({message:'Idempotency-Key required'},400);
    state.connections=[];
    return send({ok:true});
  }
  if(path.startsWith('/crm-calendar/callback/')) {
    if(state.exchangeFails) return send({message:'Exchange failed'},502);
    if(!url.searchParams.get('code')) return send({message:'Missing code'},400);
    state.connections=[{id:connectionId,provider:path.split('/').at(-1),status:'SELECT_CALENDAR',accountIdentifier:'alex@example.com'}];
    return send({workspaceId:workspace.id,connectionId,status:'SELECT_CALENDAR'});
  }
  return send({},404);
}).listen(4100,'127.0.0.1');
