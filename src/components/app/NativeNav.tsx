'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { appScreens, appScreenNames } from '@/lib/contracts';

/**
 * Top-right navigation for the Caffriend app screens — the same five the native
 * iOS app has. The CRM is a separate product and is deliberately not listed here.
 */
export default function NativeNav() {
  const pathname = usePathname();
  const current = pathname.replace(/^\//, '');
  return <nav className="native-nav" aria-label="Caffriend app">
    <ul>
      {appScreens.map(screen => <li key={screen}>
        <Link href={`/${screen}`} aria-current={screen === current ? 'page' : undefined}>{appScreenNames[screen]}</Link>
      </li>)}
    </ul>
  </nav>;
}
