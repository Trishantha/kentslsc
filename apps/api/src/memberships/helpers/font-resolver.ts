import { fileURLToPath } from 'url';

export async function resolveFontFile(file: string): Promise<string> {
  return fileURLToPath(import.meta.resolve(`@fontsource/inter/files/${file}`));
}
