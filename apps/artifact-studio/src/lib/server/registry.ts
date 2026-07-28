/**
 * registry.ts — die laufenden Sitzungen im Prozess.
 *
 * Eine Sitzung von der Platte zu laden ergibt bei jedem Aufruf ein neues
 * Objekt — und damit ein neues `busy`-Flag und einen zweiten Editor auf
 * derselben Arbeitsdatei. Die Registry hält deshalb genau eine Instanz je Id.
 *
 * Sie überlebt einen Neustart des Dev-Servers nicht, und das ist in Ordnung:
 * der Zustand liegt in `session.json`, die Instanz wird beim nächsten Zugriff
 * daraus wiederhergestellt. Verloren geht nur ein Turn, der beim Neustart
 * gerade lief — der wäre ohnehin abgerissen.
 */
import { StudioSession } from './session';

const live = new Map<string, StudioSession>();

export function getSession(id: string): StudioSession | null {
  const known = live.get(id);
  if (known) return known;
  const loaded = StudioSession.load(id);
  if (loaded) live.set(id, loaded);
  return loaded;
}

export function registerSession(session: StudioSession): void {
  live.set(session.id, session);
}
