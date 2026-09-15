'use client';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import type { AppPerson } from '@/lib/app-projection';
import {
  convertWeeklyAvailabilityUTCToLocal, formatWeeklyAvailabilityLabel, getViewerTimeZone, sortWeeklyAvailability,
} from '@/lib/weekly-availability';
import { Modal } from './Table';

/**
 * Someone else's profile, in a modal.
 *
 * A direct port of the native public profile screen
 * (`components/Profile/PublicProfileContent.tsx`) — same order, same sections,
 * and the same measurements and colours, taken from that file's stylesheet
 * rather than restated in web terms. Opened from a row in Connections or the
 * Leaderboard, both of which carry only a name and an image, so the full record
 * is fetched when the modal opens.
 */

/**
 * The row icons, drawn as the native screen's own icons: MaterialIcons `work`,
 * Ionicons `book-outline`, FontAwesome `user`, Ionicons `location-outline`,
 * `calendar-outline`, `logo-linkedin` and `link-outline`, and the coffee mug.
 * 21px and `currentColor`, exactly as they are passed there.
 */
const Icon = ({path, filled}:{path:string; filled?:boolean}) =>
  <svg className="pp-icon" viewBox="0 0 24 24" width="21" height="21" aria-hidden="true" focusable="false"
    fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>;

const icons = {
  work: 'M10 4h4a2 2 0 0 1 2 2v2h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h4V6a2 2 0 0 1 2-2Zm0 4h4V6h-4v2ZM2 12h20',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5ZM4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5Z',
  user: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.2 0-7.5 2.4-7.5 5.2V21h15v-1.8c0-2.8-3.3-5.2-7.5-5.2Z',
  location: 'M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Zm0-8.5a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z',
  calendar: 'M7 3v3m10-3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
  mug: 'M4 8h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm12 1h2.5a2.5 2.5 0 0 1 0 5H16M6 2v2m4-2v2',
  linkedin: 'M4.5 3a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6ZM3 8.6h3V21H3V8.6Zm5.4 0h2.9v1.7h.04c.4-.76 1.4-1.56 2.9-1.56 3.1 0 3.7 2 3.7 4.7V21h-3v-5.6c0-1.34-.02-3.06-1.9-3.06-1.9 0-2.2 1.46-2.2 2.96V21h-3V8.6Z',
  link: 'M10 13a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.5 1.5M14 11a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1.5-1.5',
  star: 'm12 3.5 2.6 5.3 5.9.85-4.25 4.14 1 5.86L12 16.9l-5.25 2.75 1-5.86L3.5 9.65l5.9-.85L12 3.5Z',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20v-1c0-2.5 3.1-4.5 7-4.5s7 2 7 4.5v1H2Zm16 0v-1c0-1.6-.8-3-2-4 3.3.2 6 1.9 6 4v1h-4Z',
};

const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

/** Native's `formatMonthYear`. */
const monthYear = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', {month:'short', year:'numeric'});
};

function InfoRow({icon, filled, children}:{icon:string; filled?:boolean; children:React.ReactNode}) {
  return <div className="pp-info-row"><Icon path={icon} filled={filled} /><div className="pp-info-value">{children}</div></div>;
}

export default function PersonProfile({userId, name, onClose}:{userId:string; name:string; onClose:()=>void}) {
  const [person, setPerson] = useState<AppPerson>();
  const [error, setError] = useState<string>();
  const [photo, setPhoto] = useState(0);

  useEffect(() => {
    let live = true;
    setPerson(undefined); setError(undefined); setPhoto(0);
    fetch(`/api/app/person/${encodeURIComponent(userId)}`, {headers:{'X-Caffriend-Request':'1'}, cache:'no-store'})
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new ApiError(response.status, body.error || 'Failed to load profile');
        if (live) setPerson(body as AppPerson);
      })
      .catch(problem => { if (live) setError(problem instanceof ApiError ? problem.message : 'Failed to load profile'); });
    return () => { live = false; };
  }, [userId]);

  const slots = person
    ? sortWeeklyAvailability(convertWeeklyAvailabilityUTCToLocal(person.weeklyAvailability, getViewerTimeZone()))
    : [];
  // Native's headline rule: job title and company joined by @, either alone otherwise.
  const headline = person && (person.jobTitle && person.company ? `${person.jobTitle} @ ${person.company}`
    : `${person.jobTitle || ''}${person.company ? `${person.jobTitle ? ' ' : ''}@ ${person.company}` : ''}`);
  const cover = person?.media[photo]?.url ?? person?.image ?? null;

  return <Modal title={person?.name || name} onClose={onClose}>
    <div className="person-profile">
      {!person && !error && <p role="status" className="pp-loading">Loading profile…</p>}
      {error && <p role="alert" className="pp-error">{error}</p>}
      {person && <>
        <div className="pp-slider">
          {cover
            // eslint-disable-next-line @next/next/no-img-element -- provider-hosted media are not a configured Next image domain
            ? <img className="pp-photo" src={cover} alt="" />
            : <div className="pp-photo pp-photo-empty" aria-hidden="true"><span>{initials(person.name)}</span></div>}

          {/* The carousel's progress lines, in the same place and size. */}
          {person.media.length > 1 && <div className="pp-pagination">
            {person.media.map((item, index) => <button key={item.id} type="button"
              className={`pp-pagination-line${index === photo ? ' current' : ''}`}
              aria-label={`Photo ${index + 1} of ${person.media.length}`} aria-current={index === photo}
              onClick={() => setPhoto(index)} />)}
          </div>}

          <div className="pp-name-card">
            <h2 className="pp-name">{person.name}</h2>
            {person.role && <p className="pp-role">{person.role}</p>}
          </div>
        </div>

        <div className="pp-section">
          <div className="pp-info-card">
            {headline && <InfoRow icon={icons.work} filled>{headline}</InfoRow>}
            {person.university && <InfoRow icon={icons.book}>{person.university}</InfoRow>}
            {person.pronouns && <InfoRow icon={icons.user} filled>{person.pronouns}</InfoRow>}
            {person.location && <InfoRow icon={icons.location} filled>{person.location}</InfoRow>}
            <InfoRow icon={icons.calendar}>
              {slots.length
                ? <ul className="pp-availability">{slots.map((slot, index) =>
                    <li key={`${slot.dayOfWeek}-${slot.startTime}-${index}`}>{formatWeeklyAvailabilityLabel(slot)}</li>)}</ul>
                : 'Available anytime'}
            </InfoRow>
            {person.coffeeChatTags.length > 0 && <InfoRow icon={icons.mug}>
              <ul className="pp-tags">{person.coffeeChatTags.map((tag, index) => <li key={`${tag}-${index}`}>{tag}</li>)}</ul>
            </InfoRow>}
          </div>

          {(person.linkedInUrl || person.websiteUrl) && <div className="pp-links-card">
            {person.linkedInUrl && <InfoRow icon={icons.linkedin} filled>
              <a href={person.linkedInUrl} target="_blank" rel="noreferrer noopener">{person.linkedInUrl}</a>
            </InfoRow>}
            {person.websiteUrl && <InfoRow icon={icons.link}>
              <a className="pp-portfolio" href={person.websiteUrl} target="_blank" rel="noreferrer noopener">{person.websiteUrl}</a>
            </InfoRow>}
          </div>}

          {person.prompts.length > 0 && <div className="pp-card pp-prompts">
            {person.prompts.map((prompt, index) => <div key={index} className="pp-prompt">
              <p className="pp-question">{prompt.question}</p>
              <p className="pp-answer">{prompt.answer}</p>
            </div>)}
          </div>}

          {person.projects.length > 0 && <div className="pp-card">
            <ul className="pp-projects">
              {person.projects.map((project, index) => <li key={project.id ?? index}>
                {project.imageUrl &&
                  // eslint-disable-next-line @next/next/no-img-element -- provider-hosted media are not a configured Next image domain
                  <img src={project.imageUrl} alt="" />}
                {project.description && <p>{project.description}</p>}
                {project.projectLink && <a href={project.projectLink} target="_blank" rel="noreferrer noopener">View project</a>}
              </li>)}
            </ul>
          </div>}

          {person.workExperiences.length > 0 && <div className="pp-card">
            <p className="pp-small-heading">Companies I&apos;ve worked at</p>
            {person.workExperiences.map((job, index) => <div className="pp-experience" key={`${job.company ?? 'company'}-${index}`}>
              <p className="pp-exp-title">{job.position || ''}</p>
              <p className="pp-exp-company">{job.company || ''}</p>
              <p className="pp-exp-date">{job.isCurrentlyWorking
                ? 'Currently working'
                : `${monthYear(job.startDate)} - ${monthYear(job.endDate)}`}</p>
            </div>)}
          </div>}

          <div className="pp-stats">
            <div className="pp-tile">
              <span className="pp-tile-number">{Number(person.avgRating ?? 0).toFixed(1)}</span>
              <Icon path={icons.star} filled />
            </div>
            <div className="pp-tile pp-tile-img">
              <Icon path={icons.people} filled />
              <span className="pp-tile-text">{Number(person.matches ?? 0)} connections</span>
            </div>
            <div className="pp-tile pp-tile-img">
              <Icon path={icons.mug} />
              <span className="pp-tile-text">{Number(person.coffeeChats ?? 0)} Coffee Chat</span>
            </div>
          </div>
        </div>
      </>}
    </div>
  </Modal>;
}
