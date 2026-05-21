/**
 * Ajusta dist/ para GitHub Pages: título, manifest PWA e ícones corretos no desktop.
 */
import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');
const baseUrl = (process.env.EXPO_BASE_URL || '/apptaf').replace(/\/$/, '') || '';
const prefix = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`;

const indexPath = path.join(distDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('patch-web-dist: dist/index.html não encontrado');
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<title>[^<]*<\/title>/, '<title>TAF · Teste de Aptidão Física</title>');
html = html.replace(/<html lang="en">/, '<html lang="pt-BR">');

const headInject = `
    <meta name="description" content="Sistema TAF — Teste de Aptidão Física" />
    <meta name="theme-color" content="#1C1C22" />
    <link rel="manifest" href="${prefix}/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="${prefix}/assets/icon.png" />
`;

if (!html.includes('manifest.webmanifest')) {
  html = html.replace('</head>', `${headInject}\n  </head>`);
}

const faviconPng = path.join(distDir, 'assets', 'icon.png');
const faviconLink = `<link rel="icon" type="image/png" href="${prefix}/favicon.ico" />`;
if (!html.includes('type="image/png"')) {
  html = html.replace(/<link rel="icon"[^>]*>/, faviconLink);
}

fs.writeFileSync(indexPath, html);

const manifest = {
  name: 'TAF — Teste de Aptidão Física',
  short_name: 'TAF',
  description: 'Sistema TAF — Teste de Aptidão Física',
  start_url: `${prefix}/`,
  scope: `${prefix}/`,
  display: 'standalone',
  background_color: '#1C1C22',
  theme_color: '#1C1C22',
  lang: 'pt-BR',
  icons: [
    {
      src: `${prefix}/favicon.ico`,
      sizes: '48x48',
      type: 'image/x-icon',
    },
  ],
};

if (fs.existsSync(faviconPng)) {
  manifest.icons.push({
    src: `${prefix}/assets/icon.png`,
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any maskable',
  });
}

fs.writeFileSync(
  path.join(distDir, 'manifest.webmanifest'),
  JSON.stringify(manifest, null, 2),
);

console.log('patch-web-dist: OK', prefix);
