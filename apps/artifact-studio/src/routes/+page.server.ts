import { StudioSession } from '#lib/server/session.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ sessions: StudioSession.list() });
