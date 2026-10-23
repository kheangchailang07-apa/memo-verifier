import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { APP_BADGE } from './utils/appIdentity';

// Reflect the instance (app 1 / app 2) in the browser tab title.
document.title = `${APP_BADGE} - Official Company Guidelines & Staff Sign-off`;

createRoot(document.getElementById('root')!).render(<App />);
