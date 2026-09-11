import { Calls } from '@/components/app/Screens';
import { requireSession } from '../guard';
export default async function Page() {
  await requireSession('calls');
  return <Calls />;
}
