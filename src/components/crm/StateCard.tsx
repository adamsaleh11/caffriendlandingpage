import Link from 'next/link';
export default function StateCard({title,message,retry}:{title:string;message:string;retry?:()=>void}){
  return <main className="card state"><h1>{title}</h1><p role="alert">{message}</p>{retry&&<button onClick={retry}>Try again</button>}<Link href="/app" className="text-link">Back to workspaces</Link></main>;
}
