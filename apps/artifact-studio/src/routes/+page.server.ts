import { StudioSession } from '$lib/server/session';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ sessions: StudioSession.list() });
