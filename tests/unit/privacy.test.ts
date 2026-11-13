import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guard rail for a PUBLIC repo: fixtures and source must not embed personal identifiers.
 * Add patterns here if new identifiers ever need blocking. This is a safety net, not a proof.
 */
const BLOCKED = [
  /@gmail\.com/i,
  /\bapi[_-]?key\s*[:=]/i,
  /\bsecret\s*[:=]/i,
  /BEGIN [A-Z ]*PRIVATE KEY/,
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe('public repository hygiene', () => {
  it('source and fixtures contain no blocked patterns', () => {
    for (const f of files('src')) {
      const text = readFileSync(f, 'utf8');
      for (const re of BLOCKED) expect(re.test(text), `${f} matches ${re}`).toBe(false);
    }
  });

  it('demo fixtures are labelled synthetic', () => {
    const demo = readFileSync('src/data/fixtures/demo.ts', 'utf8');
    expect(demo).toContain('SYNTHETIC DEMO DATA');
    expect(demo).toContain("kind: 'demo'");
  });
});
