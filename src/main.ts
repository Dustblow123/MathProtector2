import '@fontsource/orbitron/latin-500.css';
import '@fontsource/orbitron/latin-700.css';
import '@fontsource/orbitron/latin-900.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import '@fontsource/lexend/latin-400.css';
import '@fontsource/lexend/latin-700.css';
import './styles/base.css';
import { App } from './app/App';

const root = document.getElementById('app');
if (!root) throw new Error('#app introuvable');
const app = new App(root);
app.go(app.profile ? 'menu' : 'profiles', undefined);

// Service worker (hors-ligne) uniquement quand la page est servie par http(s), pas en ouverture directe du fichier.
if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.register('./sw.js').catch(() => undefined);
    } catch {
      /* ignoré */
    }
  });
}

// Pour le débogage dans la console.
(window as unknown as { mp2: App }).mp2 = app;
