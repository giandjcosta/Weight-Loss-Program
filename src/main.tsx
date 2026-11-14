/**
 * PLACEHOLDER entry point (foundation PR). ChatGPT/Codex replaces this with the real UI shell
 * in `src/ui/` (codex/ui-shell). It only proves the toolchain and the shared contracts work.
 */
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { APP_NAME } from './core';
import { createMemoryRepository } from './data/memoryRepository';
import { createDemoDataset } from './data/fixtures/demo';

const repo = createMemoryRepository({ seed: createDemoDataset() });

function FoundationCheck() {
  const [count, setCount] = useState<number | undefined>(undefined);
  useEffect(() => {
    void repo.list('weights').then((w) => setCount(w.length));
  }, []);
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24, color: '#e9eeeb' }}>
      <h1>{APP_NAME}</h1>
      <p>Base tecnica pronta. L'interfaccia arriverà nella prossima PR.</p>
      <p data-testid="demo-weights">
        Pesate di esempio (dati inventati): {count === undefined ? '…' : count}
      </p>
      <p>I dati non sono sincronizzati tra dispositivi.</p>
    </main>
  );
}

document.body.style.background = '#171B1C';
render(<FoundationCheck />, document.getElementById('app')!);
