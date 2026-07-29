/** Print a local HS256 bearer token; no Clerk account or network access needed. */
import { JwtAuthService } from '../services/auth/index.js';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const id = option('user') ?? 'local-user';
const email = option('email');
const service = new JwtAuthService('dev');
const token = await service.signDevToken({ id, ...(email ? { email } : {}) });

// Deliberately print the credential only when this explicit local-dev script runs.
console.log(`Dev user: ${id}`);
console.log(`Authorization: Bearer ${token}`);

