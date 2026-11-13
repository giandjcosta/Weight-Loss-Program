import type { Repository } from '../../../src/core';
import type * as Backup from '../../../src/data/backup';

declare global {
  interface Window {
    ritmea: {
      repo: Repository & { close(): void };
      createBackup: typeof Backup.createBackup;
      parseBackup: typeof Backup.parseBackup;
      restoreBackup: typeof Backup.restoreBackup;
      serializeBackup: typeof Backup.serializeBackup;
    };
  }
}
export {};
