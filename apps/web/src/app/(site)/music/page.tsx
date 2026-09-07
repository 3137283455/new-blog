import { redirect } from 'next/navigation';
import { loadMusic } from '../../../features/site/site-data';
export default async function Page() { const tracks = await loadMusic(); redirect(tracks.length ? '/music/0' : '/'); }
