import { Leaderboard } from '@/components/app/Screens';
import { requireSession } from '../guard';
export default async function Page() {
  const session = await requireSession('leaderboard');
  return <Leaderboard meId={session.user.id} />;
}
