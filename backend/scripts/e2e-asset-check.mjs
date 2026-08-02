import http from 'node:http';
import fs from 'node:fs';

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
        const chunks = [];
        resp.on('data', (c) => chunks.push(c));
        resp.on('end', () =>
          resolve({
            status: resp.statusCode,
            headers: resp.headers,
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    r.on('error', reject);
    if (d) r.write(d);
    r.end();
  });
}

const imports = JSON.parse(
  fs.readFileSync(new URL('../.data/imports.json', import.meta.url), 'utf8'),
);
const projectId = Object.values(imports)[0]?.projectId;
if (!projectId) {
  console.error('No project in .data/imports.json — run e2e-import-check first');
  process.exit(1);
}

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const boundary = '----assetboundary';
const payload = Buffer.concat([
  Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="t.png"\r\nContent-Type: image/png\r\n\r\n`,
  ),
  png,
  Buffer.from(`\r\n--${boundary}--\r\n`),
]);

const up = await req('POST', `/projects/${projectId}/assets`, payload, {
  'content-type': `multipart/form-data; boundary=${boundary}`,
});
console.log('upload', up.status, up.body.toString().slice(0, 400));
if (up.status !== 200) process.exit(1);

const json = JSON.parse(up.body.toString());
const fileName = json.key.split('/').at(-1);
const get = await req('GET', `/projects/${projectId}/assets/file/${fileName}`);
console.log('get-dev', get.status, get.headers['content-type'], get.body.length);
if (get.status !== 200 || get.body.length < 4) process.exit(1);
console.log('asset e2e OK', json.url);
