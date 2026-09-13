import http from 'node:http';
/** Generated rows get uuid-shaped ids, as the backend's randomUUID rows do. */
let minted = 0;
const uid = () => {
  const n = (++minted).toString(16).padStart(12,'0');
  return `0f0f0f0f-0f0f-4f0f-8f0f-${n}`;
};
export const workspace = {id:'11111111-1111-4111-8111-111111111111',name:'Studio'};
const connectionId = '33333333-3333-4333-8333-333333333333';
const oauthConnectionId = '22222222-2222-4222-8222-222222222222';
export const meetingId = '44444444-4444-4444-8444-444444444444';
const inviteToken = 'a'.repeat(43);
export const eventId = '12121212-1212-4121-8121-121212121212';
const baseEvent = () => ({id:eventId,kind:'EVENT',hostId:'host-1',title:'Builders over coffee',description:'A room for people turning thoughtful ideas into useful products.',startsAt:'2026-09-20T18:00:00.000Z',listed:true,priceCents:0,currency:'cad',status:'OPEN',micOpenOnArrival:false,spotlightTurnMs:60000,roomName:'PRIVATE_ROOM_SENTINEL'});
const baseMeeting = () => ({
  id: meetingId, workspaceId: workspace.id,
  purpose:'Coffee with Alex', startsAt:'2026-09-12T19:00:00.000Z', endsAt:'2026-09-12T19:30:00.000Z',
  timezone:'America/Toronto', status:'CONFIRMED', provider:'GOOGLE',
  joinUrl:`https://caffriend.com/meet/${inviteToken}`,
  physicalLocation:null, agenda:'Intro chat', engagementId,
  organizerId:'member-1', connectionId, errorCode:null,
  createdAt:'2026-09-01T10:00:00.000Z', updatedAt:'2026-09-01T10:00:00.000Z',
});
export const personId = '55555555-5555-4555-8555-555555555555';
const auditRows = () => [
  {id:'audit-1',workspaceId:workspace.id,createdAt:'2026-09-02T10:00:00.000Z',actorType:'MEMBER',actorMemberId:'member-1',actorAgentId:null,action:'meeting.confirmed',targetType:'Meeting',targetId:meetingId,approvalId:null},
  {id:'audit-2',workspaceId:workspace.id,createdAt:'2026-09-03T10:00:00.000Z',actorType:'MEMBER',actorMemberId:'member-1',actorAgentId:null,action:'meeting.join_link_issued',targetType:'Meeting',targetId:meetingId,approvalId:null},
  // The backend names a record action `<resource>.<verb>` and sets targetType to the resource key.
  {id:'audit-3',workspaceId:workspace.id,createdAt:'2026-09-04T10:00:00.000Z',actorType:'AGENT',actorMemberId:null,actorAgentId:'agent-9',action:'people.updated',targetType:'people',targetId:personId,approvalId:null},
  // The creation event a person's provenance is read from: an agent added them.
  {id:'audit-0',workspaceId:workspace.id,createdAt:'2026-09-01T10:00:00.000Z',actorType:'AGENT',actorMemberId:null,actorAgentId:'agent-9',action:'people.created',targetType:'people',targetId:personId,approvalId:null},
];
export const pipelineId = '66666666-6666-4666-8666-666666666666';
/** The canonical lifecycle, as the stage rows a workspace actually holds. */
export const stageA = '77777777-7777-4777-8777-777777777777'; // Prospect
export const stageB = '88888888-8888-4888-8888-888888888888'; // Contacted
export const lifecycleStages = [
  {id: stageA, name: 'Prospect', terminalOutcome: null},
  {id: stageB, name: 'Contacted', terminalOutcome: null},
  {id: '77777777-7777-4777-8777-000000000005', name: 'Meeting booked', terminalOutcome: null},
  {id: '77777777-7777-4777-8777-000000000007', name: 'Follow-up', terminalOutcome: null},
  {id: '77777777-7777-4777-8777-000000000009', name: 'Closed', terminalOutcome: 'CLOSED'},
];
export const engagementId = '99999999-9999-4999-8999-999999999999';
export const approvalId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const artifactId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const claimId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const conversationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const stamp = {createdAt:'2026-09-01T10:00:00.000Z', updatedAt:'2026-09-01T10:00:00.000Z'};
const crmDefaults = () => ({
  people: [{id:personId, workspaceId:workspace.id, displayName:'Alex Rivera', title:'Engineer', location:'Toronto', email:'alex@example.com', phone:null, sourceCategory:'MANUAL', organizationId:null, archivedAt:null, ...stamp,
            // Must never reach the browser: opt-in network identity, not workspace data.
            linkedUserId:'PRIVATE_USER_SENTINEL'}],
  organizations: [{id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', workspaceId:workspace.id, name:'Acme', domain:'acme.test', archivedAt:null, ...stamp}],
  engagements: [{id:engagementId, workspaceId:workspace.id, personId, organizationId:null, pipelineId, stageId:stageA, ownerId:null, status:'OPEN', objective:'Coffee chat about the platform team', nextAction:'Send a note', archivedAt:null, ...stamp}],
  notes: [], tasks: [], conversations: [{id:conversationId, workspaceId:workspace.id, provider:'ChatGPT', providerConversationId:'conv-1', title:'Prospect research', durableUrl:null, ...stamp}],
  'source-artifacts': [{id:artifactId, workspaceId:workspace.id, filename:'prospect-brief.pdf', mediaType:'application/pdf', sizeBytes:1024, sha256:null, sourceOwner:'Acme', publisher:'Acme Press', acquisitionMethod:'UPLOAD', sourceUrl:null, licenseTermsRef:'https://acme.test/terms', permittedUseBasis:'Licensed for internal research', restrictions:'No republication', retentionStatus:'RETAINED', reviewStatus:'REVIEWED', reviewAt:'2026-09-02T10:00:00.000Z', rightsState:'PERMITTED', permittedUses:['OUTREACH'], ...stamp}],
  'source-claims': [{id:'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1', workspaceId:workspace.id, artifactId, conversationId, personId, engagementId:null, targetField:'title', extractedValue:'Engineer', locator:'page 4, paragraph 2', confidence:0.82, rightsState:'PERMITTED', permittedUses:['OUTREACH'], ...stamp},
                    {id:claimId, workspaceId:workspace.id, artifactId, conversationId, personId:null, engagementId:null, targetField:'displayName', extractedValue:'Jordan Patel', locator:'page 4, paragraph 2', confidence:0.82, rightsState:'PERMITTED', permittedUses:['OUTREACH'], ...stamp}],
  approvals: [{id:approvalId, workspaceId:workspace.id, action:'people', payload:{data:{displayName:'Jordan Patel', sourceCategory:'IMPORTED'}, claimIds:[claimId]}, rightsState:'PERMITTED', status:'PENDING', reason:null, requesterMemberId:null, requesterAgentId:'agent-9', reviewerId:null, ...stamp}],
  'audit-events': auditRows(),
  agents: [{id:'agent-9', workspaceId:workspace.id, name:'Notes Assistant', status:'ACTIVE', ...stamp}],
  meetings: [baseMeeting()],
});

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
  if(path === '/group-calls/events' && req.method === 'GET') return send(state.events ?? [baseEvent()]);
  const eventResolve = path.match(/^\/group-calls\/([0-9a-f-]{36})\/resolve$/i);
  if(eventResolve) {
    const event=(state.events??[baseEvent()]).find(row=>row.id===eventResolve[1]);
    return event?send({id:event.id,kind:'EVENT',title:event.title,description:event.description,startsAt:event.startsAt,micOpenOnArrival:false}):send({message:'Not found'},404);
  }
  if(path === `/group-calls/${eventId}/spotlight`) return send(state.spotlight ?? {holderId:null,remainingMs:0,reconnecting:false,finished:true});
  if(path === '/meeting-invitations/resolve') {
    if(state.outreachUnavailable || body.token !== inviteToken) return send({message:'Invitation unavailable'},404);
    return send({purpose:'Coffee chat about the platform team',message:'Would love to hear about your team.',timezone:'America/Toronto',conference:'Caffriend call',recipientEmail:'guest@example.com',decision:state.outreachDecision??'PENDING',sender:{displayName:'Alex Rivera',jobTitle:'Founder'},slots:[{id:'slot-1',startsAt:'2026-09-20T15:00:00.000Z',endsAt:'2026-09-20T15:30:00.000Z'},{id:'slot-2',startsAt:'2026-09-21T16:00:00.000Z',endsAt:'2026-09-21T16:30:00.000Z'}]});
  }
  if(path === '/meeting-invitations/decide') {
    if(body.token !== inviteToken) return send({message:'Invitation unavailable'},404);
    if(body.decision==='ACCEPTED'&&!body.slotId)return send({message:'Invalid slotId'},400);
    state.outreachDecision=body.decision;
    if(body.decision==='ACCEPTED') {
      state.crm ??= crmDefaults();
      const booked=(state.stages??lifecycleStages).find(row=>row.name.toLowerCase()==='meeting booked');
      const engagement=state.crm.engagements.find(row=>row.id===engagementId);
      if(booked&&engagement) engagement.stageId=booked.id;
    }
    return send({purpose:'Coffee chat about the platform team',message:'Would love to hear about your team.',timezone:'America/Toronto',conference:'Caffriend call',decision:body.decision,sender:{displayName:'Alex Rivera'},slots:[]});
  }
  if(path==='/user/social/google') {
    if(state.googleFails) return send({message:'Invalid Google token'},401);
    // The real endpoint signs in or creates; `isNew` says which happened.
    state.googleSignIns=(state.googleSignIns??0)+1;
    const googleToken='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:'user-guest',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.test-signature';
    return send({success:true,data:{token:googleToken,user:{id:'user-guest',firstName:'Sam',email:'guest@example.com',isNew:state.googleExisting!==true}}});
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

  if(path==='/group-calls' && req.method==='POST') {
    const created={...baseEvent(),id:uid(),hostId:'user-1',title:body.title,description:body.description??null,startsAt:body.startsAt,listed:body.listed===true,priceCents:body.priceCents??0,spotlightTurnMs:body.spotlightTurnMs??60000};
    state.events=[...(state.events??[baseEvent()]),created];return send(created);
  }
  if(path === `/group-calls/${eventId}/register`) {state.registered=true;return send({participantId:'participant-me'});}
  if(path === `/group-calls/${eventId}/join`) {if(!state.registered)return send({message:'Registration required'},403);return send({token:'test-event-livekit-token',url:'wss://livekit.test'});}
  if(path === `/group-calls/${eventId}/roster`) return send(state.roster??[
    {participantId:'participant-jordan',userId:'u-2',displayName:'Jordan Patel',isGuest:false,canConnect:true,reasons:['Both in fintech','Both in Toronto']},
    {participantId:'participant-sam',userId:'u-3',displayName:'Sam Okonkwo',isGuest:false,canConnect:true,reasons:['Both studied at UofT']},
  ]);
  if(path === `/group-calls/${eventId}/connect`) return send({state:'saved',mutual:false,threadId:null,matcherId:null});
  if(path === `/group-calls/${eventId}/spotlight/start`) {state.spotlight={holderId:'participant-jordan',remainingMs:60000,reconnecting:false,finished:false};return send(state.spotlight);}
  if(path === `/group-calls/${eventId}/end`) return send({threadId:null});

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
  const mailBase=`/workspaces/${workspace.id}/mail-connections`;
  if(path===`${mailBase}/${connectionId}`) return send({connectionId,provider:'GOOGLE',canSend:state.mailConnected!==false,senderAddress:state.mailConnected===false?undefined:'alex@example.com',grantedScopes:state.mailConnected===false?[]:['https://www.googleapis.com/auth/gmail.send'],mailStatus:state.mailConnected===false?'NOT_CONNECTED':'ACTIVE'});
  if(path===`${mailBase}/${connectionId}/connect`) {
    const redirectUri = state.mailRedirectUri ?? 'http://localhost:3100/crm-mail/callback/GOOGLE';
    return send({redirect:`https://accounts.google.com/o/oauth2/v2/auth?client_id=test&state=state-GOOGLE-MAIL&redirect_uri=${encodeURIComponent(redirectUri)}`});
  }
  if(path===`${mailBase}/${connectionId}/revoke`){state.mailConnected=false;return send({connectionId,canSend:false,mailStatus:'REVOKED'});}
  if(path==='/crm-outreach/mail-callback/GOOGLE'){state.mailConnected=true;return send({connectionId,provider:'GOOGLE',canSend:true,senderAddress:'alex@example.com',grantedScopes:['https://www.googleapis.com/auth/gmail.send'],mailStatus:'ACTIVE'});}
  const outreachBase=`/workspaces/${workspace.id}/meeting-outreach`;
  if(path===`${outreachBase}/preview`){if(state.conferenceUnsupported)return send({code:'CONFERENCE_UNSUPPORTED',message:'This calendar cannot create Google Meet. Choose a Caffriend call.'},400);return send({subject:`Coffee chat with Alex Rivera: ${body.purpose}`,html:`<main><h1>${body.purpose}</h1><p>${body.message}</p></main>`,text:`${body.purpose}\n${body.message}`,from:'alex@example.com',to:body.recipientEmail,slots:body.slots,previewToken:'preview-not-a-live-invitation'});}
  if(path===outreachBase){if(!req.headers['idempotency-key'])return send({message:'Idempotency-Key required'},400);return send({id:'abababab-abab-4bab-8bab-abababababab',sendStatus:'SENT',from:'alex@example.com',to:body.recipientEmail,decision:'PENDING'});}
  if(path.endsWith('/connect')) {
    const provider = path.split('/').at(-2);
    if(state.connectFails) return send({message:'Unavailable'},503);
    const host = provider==='GOOGLE' ? 'accounts.google.com/o/oauth2/v2/auth' : 'login.microsoftonline.com/common/oauth2/v2.0/authorize';
    const redirectUri = state.calendarRedirectUri ?? `http://localhost:3100/crm-calendar/callback/${provider}`;
    return send({redirect:`https://${host}?client_id=test&state=state-${provider}&redirect_uri=${encodeURIComponent(redirectUri)}`});
  }
  if(path===`${calendarBase}/${connectionId}/calendars`) return send([{id:'primary',name:'Alex — Work',writable:true,supportsConference:true},{id:'readonly',name:'Holidays',writable:false,supportsConference:false}]);
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
  // ---- consumer surface: same endpoints the native app calls ----
  // The signed-in person's own record, mutated by the profile editor below.
  state.me ??= {id:'user-1',firstName:'Alex',lastName:'Rivera',email:'alex@example.com',role:'mentee',image_url:null,bio:'Building things.',
    media:[{id:'photo-1',url:'https://cdn.example.com/alex-1.jpg'}],weeklyAvailability:[]};
  if(path==='/user/my-profile') return send({data:state.me});
  if(path==='/user/profile' && req.method==='PUT') {
    if(state.saveFails) return send({message:'Save failed'},503);
    state.me={...state.me,...body};
    return send({data:state.me});
  }
  if(path==='/user/role' && req.method==='PUT') { state.me={...state.me,role:String(body.role).toLowerCase()}; return send({data:state.me}); }
  if(path==='/media/upload' && req.method==='POST') {
    state.me.media=[...(state.me.media??[]),{id:`photo-${state.me.media.length+1}`,url:`https://cdn.example.com/alex-${state.me.media.length+1}.jpg`}];
    return send({id:'photo-new',url:'https://cdn.example.com/alex-new.jpg'});
  }
  if(path.startsWith('/media/') && req.method==='DELETE') {
    const id=path.split('/').at(-1);
    state.me.media=(state.me.media??[]).filter(m=>m.id!==id);
    return send({message:'Deleted'});
  }
  if(path.startsWith('/media/user/')) return send([]);
  if(path.startsWith('/basic-details/answers/')) {
    const id=path.split('/').at(-1);
    if(id!=='u-2') return send({basicDetails:[]});
    return send({basicDetails:[{answer:'Career advice',questionType:'COFFEE_CHAT_TYPE'}],
      promptsBlocks:[{question:'Best advice you ever got?',answer:'Ship it, then listen.'}],
      workExperiences:[{position:'Staff Engineer',company:'Acme',startDate:'2022-01-01',endDate:null,isCurrentlyWorking:true}],
      projects:[{id:'p-1',description:'A fintech ledger',projectLink:'https://acme.test/ledger',imageUrl:null}],
      avgRating:4.6,matches:12,coffeeChat:7});
  }
  if(path==='/match/suggestions') {
    const rows=[
      {userId:'u-2',firstName:'Jordan',lastName:'Patel',role:'mentor',score:0.9,avgRating:4.6,matches:12,image_url:null},
      {userId:'u-3',firstName:'Sam',lastName:'Okonkwo',role:'mentee',score:0.7,avgRating:4.1,matches:3,image_url:null},
      {userId:'user-1',firstName:'Alex',lastName:'Rivera',role:'mentee',image_url:null},
    ];
    return send({data:rows,page:body.page??1,totalPages:1});
  }
  if(path.startsWith('/user/profile/')) {
    const id=path.split('/').at(-1);
    if(state.profileFails) return send({message:'Unavailable'},503);
    const people={
      'u-2':{id:'u-2',firstName:'Jordan',lastName:'Patel',job_title:'Staff Engineer',industry:'Fintech',company:'Acme',university:'UofT',location:'Toronto',role:'mentor',pronouns:'she/her',linkedInUrl:'https://linkedin.com/in/jordan',websiteUrl:null,avgRating:4.6,matches:12,image_url:null,
             email:'PRIVATE_CONTACT_SENTINEL',phoneNumber:'PRIVATE_CONTACT_SENTINEL',rate:'PRIVATE_CONTACT_SENTINEL',subscription:'PRIVATE_CONTACT_SENTINEL'},
      'u-3':{id:'u-3',firstName:'Sam',lastName:'Okonkwo',job_title:'Product Designer',industry:'Healthcare',company:'Beta Health',university:null,location:'Vancouver',role:'mentee',pronouns:null,avgRating:4.1,matches:3,image_url:null},
    };
    return send(people[id] ? {user:people[id]} : {message:'Not found'},people[id]?200:404);
  }
  if(path==='/match/create-match') {
    if(state.createMatchFails) return send({status:400,message:'That person is no longer available.'});
    return send({isMatched:true,userMatcherId:'m-1'});
  }
  if(path==='/match/matches') return send({
    all:[{id:'m-1',isMatched:true,isNew:false,isViewed:true,updatedAt:'2026-09-05T10:00:00.000Z',chatId:'t-1',
          deciderUser:{id:'user-1',firstName:'Alex',lastName:'Rivera'},targetUser:{id:'u-2',firstName:'Jordan',lastName:'Patel',image_url:null}}],
    pending:[{id:'m-2',isMatched:false,isNew:true,isViewed:false,updatedAt:'2026-09-06T10:00:00.000Z',
          deciderUser:{id:'u-3',firstName:'Sam',lastName:'Okonkwo',image_url:null},targetUser:{id:'user-1',firstName:'Alex',lastName:'Rivera'}}],
    new:[], newUser:[],
  });
  if(path.startsWith('/calendar/accepted-events/')) return send([
    {id:'e-1',startDate:'2026-09-20T15:00:00.000Z',endDate:'2026-09-20T15:30:00.000Z',format:'Video call',notes:'Intro chat',
     isPaid:true,amount:0,messageThreadId:'t-1',source:'CRM',venue:'CAFFRIEND_LIVEKIT',joinUrl:`https://caffriend.com/meet/${inviteToken}`,timezone:'America/Toronto',purpose:'Coffee with Jordan',meetingId,workspaceId:workspace.id,engagementId,counterpartName:'Jordan Patel',status:'BOOKED',
     booker:{id:'u-2',firstName:'Jordan',lastName:'Patel',image_url:null},
     targetUser:{id:'user-1',firstName:'Alex',lastName:'Rivera',image_url:null}},
  ]);
  if(path==='/leaderboard') return send({currentPage:1,totalPages:1,totalCount:2,hasNextPage:false,usersPerPage:50,timeRange:'all',type:'combined',
    users:[
      {userId:'u-2',firstName:'Jordan',lastName:'Patel',rank:1,combinedScore:120,totalChats:9,totalMatches:12,totalMessages:80,image_url:null},
      {userId:'user-1',firstName:'Alex',lastName:'Rivera',rank:2,combinedScore:90,totalChats:4,totalMatches:6,totalMessages:40,image_url:null},
    ]});

  // ---- CRM ----
  const crmBase = `/workspaces/${workspace.id}/crm`;
  state.crm ??= crmDefaults();
  const page = (rows) => {
    const allowed = ['cursor','limit','search','pipelineId'];
    if([...url.searchParams.keys()].some(k=>!allowed.includes(k))) return send({message:'Unknown input field'},400);
    let list = rows;
    const search = url.searchParams.get('search');
    if(search) list = list.filter(row => String(row.displayName ?? row.name ?? '').toLowerCase().includes(search.toLowerCase()));
    const pipeline = url.searchParams.get('pipelineId');
    if(pipeline) list = list.filter(row => row.pipelineId === pipeline);
    const cursor = url.searchParams.get('cursor');
    const start = cursor ? list.findIndex(row=>row.id===cursor)+1 : 0;
    const items = list.slice(start, start+25);
    const consumed = start + items.length;
    return send({items, nextCursor: consumed < list.length ? items[items.length-1].id : null});
  };

  if(path === `${crmBase}/people/${personId}/permissions`)
    return send(state.permissions ?? {id:personId, permittedUses:['OUTREACH'], blocked:false});

  if(path === `${crmBase}/approvals/${approvalId}/review`) {
    if(!req.headers['idempotency-key']) return send({message:'Idempotency-Key required'},400);
    const row = state.crm.approvals.find(a=>a.id===approvalId);
    if(row.status !== 'PENDING') return send({message:'Proposal already reviewed'},409);
    if(state.reviewConflict) { row.status='APPROVED'; return send({message:'Proposal already reviewed'},409); }
    row.status = body.decision; row.reason = body.reason ?? null;
    if(body.decision==='APPROVED') state.crm.people.push({id:'ffffffff-ffff-4fff-8fff-ffffffffffff', workspaceId:workspace.id, displayName:(body.data ?? row.payload.data).displayName, sourceCategory:'IMPORTED', archivedAt:null, ...stamp});
    return send({id:approvalId, status:body.decision, result:null});
  }

  if(path.startsWith(crmBase + '/')) {
    const rest = path.slice(crmBase.length+1).split('/');
    const [resource, id] = rest;
    // A test that posts a partial `crm` state must not take the server down and
    // fail every test after it: an absent collection is simply empty.
    const rows = state.crm[resource] ?? [];
    if(!rows) return send({message:'Unknown CRM resource'},400);
    if(req.method==='GET' && !id) return page(rows);
    if(req.method==='GET') { const row = rows.find(r=>r.id===id); return row ? send(row) : send({message:'Resource not found'},404); }
    if(!req.headers['idempotency-key']) return send({message:'Idempotency-Key required'},400);
    if(req.method==='POST') {
      if(state.writeFails) return send({message:'Unavailable'},503);
      const row = {id:uid(), workspaceId:workspace.id, archivedAt:null, ...stamp, ...body};
      rows.push(row); return send(row);
    }
    if(req.method==='PATCH') {
      if(state.moveFails) return send({message:'That stage is unavailable'},409);
      const row = rows.find(r=>r.id===id);
      if(!row) return send({message:'Resource not found'},404);
      Object.assign(row, body); return send(row);
    }
    if(req.method==='DELETE') {
      state.crm[resource] = rows.filter(r=>r.id!==id);
      return send({id, status:rest[2] === 'permanent' ? 'DELETED' : 'ARCHIVED'});
    }
  }

  // ---- pipelines and stages ----
  const pipeBase = `/workspaces/${workspace.id}/pipelines`;
  state.pipelines ??= [{id:pipelineId, name:'Coffee chats', purpose:'Land interviews', archived:false}];
  state.stages ??= lifecycleStages.map((stage, position) =>
    ({id:stage.id, pipelineId, name:stage.name, position, terminalOutcome:stage.terminalOutcome, archived:false}));
  if(path === pipeBase) {
    if(req.method==='GET') return send(state.pipelines);
    state.pipelines.push({id:uid(), name:body.name, purpose:body.purpose, archived:false});
    return send(state.pipelines.at(-1));
  }
  if(path === `${pipeBase}/${pipelineId}`) { Object.assign(state.pipelines[0], body); return send(state.pipelines[0]); }
  if(path === `${pipeBase}/${pipelineId}/stages`) {
    if(req.method==='GET') return send(state.stages);
    state.stages.push({id:uid(), pipelineId, name:body.name, position:state.stages.length, terminalOutcome:body.terminalOutcome ?? null, archived:false});
    return send(state.stages.at(-1));
  }
  if(path === `${pipeBase}/${pipelineId}/stages/reorder`) {
    if(state.reorderFails) return send({message:'Unavailable'},503);
    state.stages = body.stageIds.map((sid,i)=>({...state.stages.find(s=>s.id===sid), position:i}));
    return send(state.stages);
  }
  if(path.startsWith(`${pipeBase}/${pipelineId}/stages/`)) {
    const sid = path.split('/').at(-1);
    const stage = state.stages.find(s=>s.id===sid);
    if(!stage) return send({message:'Resource not found'},404);
    Object.assign(stage, body); return send(stage);
  }

  // ---- agents ----
  const oauthBase = `/workspaces/${workspace.id}/oauth`;
  if(path === `${oauthBase}/clients`) {
    if(state.registerFails) return send({message:'OWNER or ADMIN required'},403);
    return send({id:'client-new-id', name:body.name, scopes:body.scopes, redirectUris:body.redirectUris});
  }
  if(path === `${oauthBase}/connections`) return send({items: state.oauthConnections ?? [{id:oauthConnectionId, clientName:'Notes Assistant', scopes:['people:read','notes:write'], createdAt:'2026-09-02T10:00:00.000Z', revokedAt:null}], nextCursor:null});
  if(path.startsWith(`${oauthBase}/connections/`) && path.endsWith('/revoke')) {
    state.oauthConnections = [{id:oauthConnectionId, clientName:'Notes Assistant', scopes:['people:read'], createdAt:'2026-09-02T10:00:00.000Z', revokedAt:'2026-09-05T10:00:00.000Z'}];
    return send({ok:true});
  }

  // ---- meetings list, create, retry, availability ----
  if(path === meetingBase) {
    if(req.method==='GET') return page(state.crm.meetings);
    if(!req.headers['idempotency-key']) return send({message:'Idempotency-Key required'},400);
    if(state.createMeetingFails) return send({message:'The calendar provider rejected this.'},503);
    const created = {...baseMeeting(), id:uid(), purpose:body.purpose, startsAt:body.startsAt, endsAt:body.endsAt, timezone:body.timezone, status: state.meetingPending ? 'PENDING' : 'CONFIRMED', engagementId:body.engagementId};
    state.crm.meetings.push(created);
    return send(created);
  }
  if(path === `${meetingBase}/${meetingId}/retry`) return send({...state.meeting, status:'CONFIRMED'});
  if(path === `${calendarBase}/${connectionId}/availability`)
    return send(state.availability ?? {busy:[{start:'2026-09-12T19:00:00.000Z', end:'2026-09-12T20:00:00.000Z', summary:'PRIVATE_CRM_SENTINEL'}]});

  return send({},404);
}).listen(4100,'127.0.0.1');
