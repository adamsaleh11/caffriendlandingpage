import { Home } from '@/components/app/Screens';
import { requireSession } from '../guard';
export default async function Page() {
  await requireSession('home');
  return <Home />;
}
