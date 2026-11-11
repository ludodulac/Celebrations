// M017: compile independent preproduction credentials from ONE GitHub Environment
// secret. Never print raw secret, verifiers, salts, or challenge key.
import assert from 'node:assert/strict';
import {pbkdf2Sync,randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const raw=process.env.M017_ADMIN_PASSWORD||'';
const out=process.argv[2];
assert.equal(process.env.GITHUB_REF,'refs/heads/feat/celebrations-m017-admin-online-20261111');
assert.ok(raw.length>=16&&raw.length<=32&&/[a-z]/i.test(raw)&&/[0-9]/.test(raw)&&/[^a-z0-9]/i.test(raw));
assert.ok(out?.startsWith('/tmp/'));
const salt=randomBytes(32).toString('hex');
const hash=pbkdf2Sync(raw,salt,180000,32,'sha256').toString('hex');
const pinSalt=randomBytes(24).toString('hex');
const first=pbkdf2Sync(raw,'celebrations-pin-v2-step1:'+pinSalt,90000,32,'sha256');
const pinHash=pbkdf2Sync(first,'celebrations-pin-v2-step2:'+pinSalt,90000,32,'sha256').toString('hex');
writeFileSync(out,JSON.stringify({
 ADMIN_PASSWORD_SALT:salt,ADMIN_PASSWORD_HASH:hash,
 EDITOR_D1_CHALLENGE_SECRET:randomBytes(32).toString('hex'),
 M016_PIN_SALT:pinSalt,M016_PIN_VERIFIER:pinHash
}),{mode:0o600});
console.log('M017_SECRETS_CREATED_IN_TEMP_FILE count=5 values_printed=false');
