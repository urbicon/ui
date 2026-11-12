import './app.css';
import { pinLabel } from './lib/pin.ts';

document.body.className = 'bg-surface text-ink font-mono';
document.body.dataset.pin = pinLabel();
// A dynamic import: embedded by `codeSplitting: false`, but through Vite's preload helper.
void import('./lazy.ts').then(({ LAZY }) => {
  document.body.textContent = LAZY;
});
