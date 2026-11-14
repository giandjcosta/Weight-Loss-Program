/** Ritmea Alpha 0.1 — an explicitly synthetic demo; not persistent personal storage. */
import { render } from 'preact';
import { createDemoDataset } from './data/fixtures/demo';
import { createMemoryRepository } from './data/memoryRepository';
import { App } from './ui/App';

const mount = document.getElementById('app');
if (!mount) throw new Error('Ritmea mount element is missing');
const root: HTMLElement = mount;

/** Reset replaces the whole ephemeral demo repository and remounts the view. */
function start(): void {
  const repository = createMemoryRepository({ seed: createDemoDataset() });
  render(<App key={Date.now()} repository={repository} onReset={start} />, root);
}
start();
