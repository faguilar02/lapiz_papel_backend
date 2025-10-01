import * as fs from 'fs';
import * as path from 'path';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CpeStorageService {
  private basePath = process.env.CPE_STORAGE_PATH || './storage/cpe';

  ensureBase() {
    if (!fs.existsSync(this.basePath))
      fs.mkdirSync(this.basePath, { recursive: true });
  }

  saveFile(relPath: string, content: string | Buffer) {
    this.ensureBase();
    const full = path.join(this.basePath, relPath);
    const dir = path.dirname(full);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(full, content);
    return full;
  }

  async saveCdr(filename: string, cdrContent: Buffer): Promise<string> {
    const cdrPath = `cdr/R-${filename}.zip`;
    return this.saveFile(cdrPath, cdrContent);
  }
}
