import '@fontsource/orbitron/500.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/900.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './styles/base.css';
import { App } from './app/App';

const root = document.getElementById('app');
if (!root) throw new Error('#app introuvable');
const app = new App(root);
app.go(app.profile ? 'menu' : 'profiles', undefined);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}

// Pour le débogage dans la console.
(window as unknown as { mp2: App }).mp2 = app;
