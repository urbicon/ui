import { createContext } from 'svelte';

/**
 * Öffnet die globale Befehlssuche (⌘K) von überall unterhalb des Layouts.
 *
 * Die CommandSearch-Instanz lebt im Root-Layout (eine Palette für die ganze
 * App, auch auf der Landing). Ihr sichtbarer Trigger saß bisher nur im
 * Sidebar-Chrome — die Landing kannte die Suche nur als Tastenkürzel. Der
 * Context reicht den `toggle()` der Instanz nach unten, ohne dass eine Seite
 * die Komponente selbst halten muss.
 */
const [getCommandSearchToggle, setCommandSearchToggle] = createContext<() => void>();

export { getCommandSearchToggle, setCommandSearchToggle };
