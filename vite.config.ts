import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * Après le build, inline le JS et le CSS dans dist/index.html pour obtenir un fichier
 * autonome qui s'ouvre directement dans un navigateur (file://), sans serveur.
 */
function singleFile(): Plugin {
  return {
    name: 'mp2-single-file',
    apply: 'build',
    closeBundle() {
      const dist = 'dist';
      const indexPath = join(dist, 'index.html');
      let html = readFileSync(indexPath, 'utf8');
      const assets = join(dist, 'assets');
      const used: string[] = [];
      html = html.replace(/<script type="module" crossorigin src="\.\/assets\/([^"]+)"><\/script>/g, (_m: string, file: string) => {
        used.push(file);
        const js = readFileSync(join(assets, file), 'utf8').replace(/<\/script/g, '<\\/script');
        return `<script type="module">${js}</script>`;
      });
      html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/assets\/([^"]+)">/g, (_m: string, file: string) => {
        used.push(file);
        return `<style>${readFileSync(join(assets, file), 'utf8')}</style>`;
      });
      writeFileSync(indexPath, html);
      for (const f of used) rmSync(join(assets, f));
      if (readdirSync(assets).length === 0) rmSync(assets, { recursive: true });
    },
  };
}

export default defineConfig(() => ({
  // Chemins relatifs : fonctionne sur GitHub Pages (/MathProtector2/) comme en ouverture directe du fichier.
  base: './',
  plugins: [singleFile()],
  build: {
    target: 'es2022',
    sourcemap: false,
    // Les polices (woff/woff2) sont inlinées en base64 dans le CSS : un seul fichier HTML.
    assetsInlineLimit: 250_000,
    modulePreload: false,
    cssCodeSplit: false,
  },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
}));
