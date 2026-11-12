import './app.css';

document.body.className = 'bg-surface text-ink font-mono';
// A dynamic import: embedded by `codeSplitting: false`, but through Vite's preload helper.
void import('./lazy.ts').then(({ LAZY }) => {
  document.body.textContent = LAZY;
});
