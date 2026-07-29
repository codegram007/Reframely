import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function req(method, p, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const d =
      body == null
        ? null
        : Buffer.isBuffer(body)
          ? body
          : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const hdrs = { ...headers };
    if (d && !hdrs['content-type'] && !hdrs['Content-Type']) {
      hdrs['content-type'] = 'application/json';
    }
    if (d) hdrs['content-length'] = String(d.length);
    const r = http.request(
      { hostname: 'localhost', port: 3000, path: p, method, headers: hdrs },
      (resp) => {
        let b = '';
        resp.on('data', (c) => (b += c));
        resp.on('end', () => resolve({ status: resp.statusCode, body: b }));
      },
    );
    r.on('error', reject);
    if (d) r.write(d);
    r.end();
  });
}

const zipPath = path.join(process.env.TEMP || '/tmp', 'vs-hh.zip');
const fixture = path.resolve(__dirname, '../test/fixtures/sites/hand-hero');
try {
  fs.unlinkSync(zipPath);
} catch {
  /* ok */
}
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${fixture}\\*' -DestinationPath '${zipPath}' -Force"`,
);

const tok = await req('GET', '/auth/dev-token?user=local-user');
console.log('dev-token', tok.status);
if (tok.status !== 200) {
  console.log(tok.body);
  process.exit(1);
}
const { token } = JSON.parse(tok.body);
const auth = { authorization: `Bearer ${token}` };

const no = await req('GET', '/projects/x/versions');
console.log('no-auth versions', no.status);

const zip = fs.readFileSync(zipPath);
const boundary = '----vsboundary';
const head = Buffer.from(
  `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="hand-hero.zip"\r\nContent-Type: application/zip\r\n\r\n`,
);
const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
const payload = Buffer.concat([head, zip, tail]);
const imp = await req('POST', '/imports/zip', payload, {
  ...auth,
  'content-type': `multipart/form-data; boundary=${boundary}`,
});
console.log('import', imp.status, imp.body.slice(0, 400));
if (imp.status !== 200) process.exit(1);

const { importId, projectId } = JSON.parse(imp.body);
const snap = await req('POST', `/imports/${importId}/snapshot`, {}, auth);
console.log('snapshot', snap.status, snap.body.slice(0, 250));
if (snap.status !== 200) process.exit(1);

const cls = await req('POST', `/imports/${importId}/classify`, {}, auth);
console.log('classify', cls.status, cls.body.slice(0, 300));
if (cls.status !== 200) process.exit(1);

const trees = await req('GET', `/projects/${projectId}/tree`, null, auth);
console.log('trees', trees.status);
const tj = JSON.parse(trees.body);
const root = tj.primary?.tree?.root;
console.log(
  'primary',
  root?.type,
  'id',
  root?.id,
  'sections',
  root?.children?.length,
  'projectId',
  projectId,
);
