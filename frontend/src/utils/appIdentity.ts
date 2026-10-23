// Per-instance branding, driven by the Vite mode label.
// .env.apa1 sets VITE_APP_LABEL=APA1 (app 1) and .env.apa2 sets APA2 (app 2),
// so a single frontend build serves both deployments with the right badges.
const rawLabel = (import.meta.env.VITE_APP_LABEL || 'APA1').trim();

const digits = rawLabel.replace(/\D/g, '');
export const APP_NUMBER = digits || '1';

// Logo square text, e.g. "APA 1" / "APA 2".
export const APP_LOGO = `APA ${APP_NUMBER}`;

// Header title, e.g. "APA 1 Policy & Memo" / "APA 2 Policy & Memo".
export const APP_TITLE = `APA ${APP_NUMBER} Policy & Memo`;

// Header/tab badge, e.g. "Policy & Memo 1" / "Policy & Memo 2".
export const APP_BADGE = `Policy & Memo ${APP_NUMBER}`;
