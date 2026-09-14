export type FacePerson = { name: string; image: string | null };

export const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

export default function Face({person}:{person:FacePerson}) {
  return person.image
    // eslint-disable-next-line @next/next/no-img-element -- provider-hosted avatars are not a configured Next image domain
    ? <img className="avatar" src={person.image} alt="" width={32} height={32} />
    : <span className="avatar initials" aria-hidden="true">{initials(person.name)}</span>;
}
