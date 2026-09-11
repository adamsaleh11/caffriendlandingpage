import { Connections } from '@/components/app/Screens';
import { requireSession } from '../guard';
export default async function Page() {
  await requireSession('connections');
  return <Connections />;
}
