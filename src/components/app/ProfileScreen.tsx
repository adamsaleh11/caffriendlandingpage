'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import type { AppProfile } from '@/lib/app-projection';
import {
  WEEKLY_DAYS, convertWeeklyAvailabilityLocalToUTC, convertWeeklyAvailabilityUTCToLocal,
  formatWeeklyAvailabilityLabel, getViewerTimeZone, isValidWeeklyTime,
  sortWeeklyAvailability, type WeeklyAvailabilitySlot, type WeeklyDayOfWeek,
} from '@/lib/weekly-availability';
import { Modal } from './Table';
import {FormSelect} from '@/components/ui/form-select';
import {TimePicker} from '@/components/ui/time-picker';

/**
 * The Profile screen, editable.
 *
 * It is deliberately the same shape as the native edit screen
 * (`app/profile/edit.tsx`): a photo strip, a mentee/mentor switch, and a list of
 * rows whose value is edited in a sheet with one "Save changes" button. Every
 * save is its own request, exactly as it is natively — a person who edits their
 * company and then closes the tab has saved their company.
 *
 * Rate, prompts, projects, work experience and coffee-chat tags are not here.
 * They are separate native editors on their own endpoints, and a partial copy
 * of them would be worse than the app link this page still offers.
 */

type Draft = Record<string, string>;

async function write<T>(path: string, options: RequestInit): Promise<T> {
  const response = await fetch(`/api/app/${path}`, {
    ...options,
    headers: {'X-Caffriend-Request':'1', ...options.headers},
    cache: 'no-store',
  });
  if (response.status === 401) { window.location.replace('/login?returnTo=/profile'); throw new ApiError(401, 'Sign in required'); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, (result as {error?:string}).error || 'That could not be saved.');
  return result as T;
}

const patch = (path: string, body: unknown) =>
  write<AppProfile>(path, {method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});

/** One row of the edit list: a label, the current value, and a chevron. */
function Row({label, value, placeholder, onOpen}:{label:string; value:string|null; placeholder:string; onOpen:()=>void}) {
  return <button type="button" className="profile-row" onClick={onOpen}>
    <span className="profile-row-label">{label}</span>
    <span className={`profile-row-value${value ? '' : ' unset'}`}>{value || placeholder}</span>
    <span className="profile-row-chevron" aria-hidden="true">›</span>
    <span className="visually-hidden">Edit {label.toLowerCase()}</span>
  </button>;
}

/** The edit sheet. Its single button saves, matching the native modals. */
function EditSheet({title, onClose, onSave, children, canSave = true}:{
  title:string; onClose:()=>void; onSave:()=>Promise<void>|void; children:React.ReactNode; canSave?:boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string>();
  return <Modal title={title} onClose={onClose}>
    <form className="profile-sheet" onSubmit={async event => {
      event.preventDefault();
      setSaving(true); setProblem(undefined);
      try { await onSave(); }
      catch (error) { setProblem(error instanceof ApiError ? error.message : 'That could not be saved.'); }
      finally { setSaving(false); }
    }}>
      <h2>{title}</h2>
      {children}
      {problem && <p role="alert">{problem}</p>}
      <button type="submit" disabled={saving || !canSave}>{saving ? 'Saving…' : 'Save changes'}</button>
    </form>
  </Modal>;
}

function Field({label, value, onChange, placeholder, type = 'text'}:{
  label:string; value:string; onChange:(value:string)=>void; placeholder?:string; type?:string;
}) {
  return <label>{label}
    <input type={type} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
  </label>;
}

const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

export default function ProfileScreen() {
  const [profile, setProfile] = useState<AppProfile>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [sheet, setSheet] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [notice, setNotice] = useState<string>();
  const [photoProblem, setPhotoProblem] = useState<string>();
  const [busyPhoto, setBusyPhoto] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    setProfile(undefined); setError(undefined);
    fetch('/api/app/me', {headers:{'X-Caffriend-Request':'1'}, cache:'no-store'})
      .then(async response => {
        if (response.status === 401) { window.location.replace('/login?returnTo=/profile'); return; }
        const body = await response.json();
        if (!response.ok) throw new ApiError(response.status, body.error || 'This could not be loaded.');
        if (live) setProfile(body as AppProfile);
      })
      .catch(problem => { if (live) setError(problem instanceof ApiError ? problem.message : 'This could not be loaded.'); });
    return () => { live = false; };
  }, [attempt]);

  const open = useCallback((name: string, values: Draft) => { setDraft(values); setNotice(undefined); setSheet(name); }, []);
  const applied = useCallback((updated: AppProfile, message: string) => {
    setProfile(updated); setSheet(null); setNotice(message);
  }, []);

  if (error) return <><h1>Profile</h1><p role="alert">{error} <button className="secondary" onClick={() => setAttempt(v => v + 1)}>Try again</button></p></>;
  if (!profile) return <><h1>Profile</h1><p role="status">Loading your profile…</p></>;

  const zone = getViewerTimeZone();
  const localSlots = sortWeeklyAvailability(convertWeeklyAvailabilityUTCToLocal(profile.weeklyAvailability, zone));

  const saveFields = async (body: Record<string, unknown>, message: string) =>
    applied(await patch('me', body), message);

  const uploadPhoto = async (file: File) => {
    setBusyPhoto(true); setPhotoProblem(undefined);
    try {
      const form = new FormData();
      form.append('file', file);
      setProfile(await write<AppProfile>('me/photo', {method:'PUT', body: form}));
      setNotice('Photo added.');
    } catch (problem) {
      setPhotoProblem(problem instanceof ApiError ? problem.message : 'That photo could not be uploaded.');
    } finally { setBusyPhoto(false); if (fileInput.current) fileInput.current.value = ''; }
  };

  const removePhoto = async (id: string) => {
    setBusyPhoto(true); setPhotoProblem(undefined);
    try {
      setProfile(await write<AppProfile>(`me/photo/${encodeURIComponent(id)}`, {method:'DELETE'}));
      setNotice('Photo removed.');
    } catch (problem) {
      setPhotoProblem(problem instanceof ApiError ? problem.message : 'That photo could not be removed.');
    } finally { setBusyPhoto(false); }
  };

  return <>
    <h1>Profile</h1>
    <p className="intro">How you appear to other people on Caffriend. Changes save as you make them.</p>
    {/* Announced rather than shown as a banner: each save is small and local. */}
    <p role="status" className="visually-hidden">{notice}</p>

    <section className="card profile-edit">
      <div className="profile-head">
        {profile.image
          // eslint-disable-next-line @next/next/no-img-element -- provider-hosted avatars are not a configured Next image domain
          ? <img className="avatar large" src={profile.image} alt="" width={64} height={64} />
          : <span className="avatar large" aria-hidden="true">{initials(profile.name)}</span>}
        <div className="profile-head-text">
          <h2>{profile.name}</h2>
          <p>{[profile.jobTitle, profile.company].filter(Boolean).join(' · ') || 'Add your job title to introduce yourself.'}</p>
        </div>
      </div>

      <h3>Photos</h3>
      <ul className="photo-strip">
        {profile.media.map(photo => <li key={photo.id}>
          {/* eslint-disable-next-line @next/next/no-img-element -- provider-hosted media are not a configured Next image domain */}
          <img src={photo.url} alt="" />
          <button type="button" className="secondary" disabled={busyPhoto} onClick={() => removePhoto(photo.id)}>Remove</button>
        </li>)}
        {!profile.media.length && <li className="photo-empty"><p className="small">No photos yet.</p></li>}
      </ul>
      <label className="photo-add">Add a photo
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic" disabled={busyPhoto}
          onChange={event => { const file = event.target.files?.[0]; if (file) uploadPhoto(file); }} />
      </label>
      {photoProblem && <p role="alert">{photoProblem}</p>}

      <h3>Account role</h3>
      <div className="role-switch" role="group" aria-label="Account role">
        {(['MENTEE','MENTOR'] as const).map(role => <button key={role} type="button"
          aria-pressed={profile.accountRole === role}
          className={profile.accountRole === role ? 'selected' : 'secondary'}
          onClick={async () => {
            if (profile.accountRole === role) return;
            try { applied(await patch('me/role', {role}), `You are now a ${role.toLowerCase()}.`); }
            catch (problem) { setPhotoProblem(problem instanceof ApiError ? problem.message : 'That could not be saved.'); }
          }}>{role === 'MENTEE' ? 'Mentee' : 'Mentor'}</button>)}
      </div>

      <h3>Details</h3>
      <div className="profile-rows">
        <Row label="Name" value={profile.name === 'Unnamed' ? null : profile.name} placeholder="Add your name"
          onOpen={() => open('name', {firstName: profile.firstName, lastName: profile.lastName})} />
        <Row label="Pronouns" value={profile.pronouns} placeholder="Add pronouns"
          onOpen={() => open('pronouns', {pronouns: profile.pronouns ?? ''})} />
        <Row label="Job title" value={profile.jobTitle} placeholder="Add role"
          onOpen={() => open('job_title', {job_title: profile.jobTitle ?? ''})} />
        <Row label="Current company" value={profile.company} placeholder="Add company"
          onOpen={() => open('company', {company: profile.company ?? ''})} />
        <Row label="Industry" value={profile.industry} placeholder="Add industry"
          onOpen={() => open('industry', {industry: profile.industry ?? ''})} />
        <Row label="University" value={profile.university} placeholder="Add university"
          onOpen={() => open('university', {university: profile.university ?? ''})} />
        <Row label="Location" value={profile.location} placeholder="Add location"
          onOpen={() => open('location', {location: profile.location ?? ''})} />
        <Row label="Links" value={profile.linkedInUrl || profile.websiteUrl} placeholder="Add link"
          onOpen={() => open('links', {linkedInUrl: profile.linkedInUrl ?? '', websiteUrl: profile.websiteUrl ?? ''})} />
        <Row label="Weekly availability"
          value={localSlots.length ? `${localSlots.length} weekly slot${localSlots.length > 1 ? 's' : ''}` : null}
          placeholder="Available anytime" onOpen={() => open('availability', {})} />
        <Row label="Email" value={profile.email} placeholder="Not given" onOpen={() => open('email', {})} />
      </div>
    </section>

    {sheet === 'name' && <EditSheet title="Name" onClose={() => setSheet(null)} canSave={!!draft.firstName?.trim()}
      onSave={() => saveFields({firstName: draft.firstName.trim(), lastName: draft.lastName.trim()}, 'Name saved.')}>
      <Field label="First name" value={draft.firstName} onChange={v => setDraft(d => ({...d, firstName: v}))} placeholder="Enter your first name" />
      <Field label="Last name" value={draft.lastName} onChange={v => setDraft(d => ({...d, lastName: v}))} placeholder="Enter your last name" />
    </EditSheet>}

    {['pronouns','job_title','company','industry','university','location'].includes(sheet ?? '') && (() => {
      const labels: Record<string,[string,string]> = {
        pronouns: ['Pronouns','e.g. they/them'],
        job_title: ['Job title','e.g. Product Designer'],
        company: ['Current company','Where you work'],
        industry: ['Industry','e.g. Technology'],
        university: ['University','Where you studied'],
        location: ['Location','Where you are based'],
      };
      const field = sheet as string;
      const [label, placeholder] = labels[field];
      return <EditSheet title={label} onClose={() => setSheet(null)}
        onSave={() => saveFields({[field]: draft[field].trim()}, `${label} saved.`)}>
        <Field label={label} value={draft[field]} onChange={v => setDraft(d => ({...d, [field]: v}))} placeholder={placeholder} />
        <p className="small">Leave this empty to remove it from your profile.</p>
      </EditSheet>;
    })()}

    {sheet === 'links' && <EditSheet title="Links" onClose={() => setSheet(null)}
      onSave={() => saveFields({linkedInUrl: draft.linkedInUrl.trim(), websiteUrl: draft.websiteUrl.trim()}, 'Links saved.')}>
      <Field label="LinkedIn" type="url" value={draft.linkedInUrl} onChange={v => setDraft(d => ({...d, linkedInUrl: v}))}
        placeholder="https://www.linkedin.com/in/you" />
      <Field label="Website or portfolio" type="url" value={draft.websiteUrl} onChange={v => setDraft(d => ({...d, websiteUrl: v}))}
        placeholder="https://example.com" />
      <p className="small">Both must start with https://. Leave either empty to remove it.</p>
    </EditSheet>}

    {sheet === 'availability' && <AvailabilitySheet slots={localSlots} zone={zone} onClose={() => setSheet(null)}
      onSaved={updated => applied(updated, 'Weekly availability saved.')} />}

    {sheet === 'email' && <Modal title="Email" onClose={() => setSheet(null)}>
      <div className="profile-sheet">
        <h2>Email</h2>
        <p>{profile.email || 'Not given'}</p>
        {/* Changing an email is a verification flow the native app owns end to end. */}
        <p className="small">Your email is changed in the Caffriend mobile app, which confirms the new address before it takes effect.</p>
      </div>
    </Modal>}
  </>;
}

/**
 * The weekly availability editor.
 *
 * Slots are added and removed in the viewer's own zone and converted to UTC on
 * save, the same way the native screen does it — the conversion itself is the
 * shared `weekly-availability` module, so both surfaces agree across DST.
 */
function AvailabilitySheet({slots, zone, onClose, onSaved}:{
  slots:WeeklyAvailabilitySlot[]; zone:string; onClose:()=>void; onSaved:(profile:AppProfile)=>void;
}) {
  const [draft, setDraft] = useState(slots);
  const [day, setDay] = useState<WeeklyDayOfWeek>('MONDAY');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [problem, setProblem] = useState<string>();

  const add = () => {
    if (!isValidWeeklyTime(start) || !isValidWeeklyTime(end)) { setProblem('Enter times as HH:MM.'); return; }
    if (start >= end) { setProblem('The end time has to be after the start time.'); return; }
    // Same as the native list: a repeated slot is not added twice.
    if (draft.some(slot => slot.dayOfWeek === day && slot.startTime === start && slot.endTime === end)) { setProblem('That slot is already listed.'); return; }
    setProblem(undefined);
    setDraft(sortWeeklyAvailability([...draft, {dayOfWeek: day, startTime: start, endTime: end}]));
  };

  return <EditSheet title="Weekly availability" onClose={onClose} onSave={async () => {
    const utc = convertWeeklyAvailabilityLocalToUTC(draft, zone);
    onSaved(await patch('me', {weeklyAvailability: utc}));
  }}>
    <p className="small">Times are in {zone}.</p>
    <ul className="slot-list">
      {draft.map((slot, index) => <li key={`${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`}>
        <span>{formatWeeklyAvailabilityLabel(slot)}</span>
        <button type="button" className="secondary" onClick={() => setDraft(draft.filter((_, i) => i !== index))}>Remove</button>
      </li>)}
      {!draft.length && <li className="small">No slots yet — people can ask for any time.</li>}
    </ul>
    <div className="slot-add">
      <div className="field">
        <span className="field-label">Day</span>
        <FormSelect aria-label="Day" value={day} onValueChange={next => setDay(next as WeeklyDayOfWeek)} options={WEEKLY_DAYS.map(value => ({value, label: value[0] + value.slice(1).toLowerCase()}))} />
      </div>
      <div className="field"><span className="field-label">From</span><TimePicker aria-label="From" value={start} onChange={setStart} /></div>
      <div className="field"><span className="field-label">To</span><TimePicker aria-label="To" value={end} onChange={setEnd} /></div>
      <button type="button" className="secondary" onClick={add}>Add slot</button>
    </div>
    {problem && <p role="alert">{problem}</p>}
  </EditSheet>;
}
