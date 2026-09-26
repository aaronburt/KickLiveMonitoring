import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..');
const keyPath = path.join(rootDir, 'kick-monitor.pem');

export function computeExtensionId(publicKeyDer) {
  const hash = crypto.createHash('sha256').update(publicKeyDer).digest('hex').slice(0, 32);
  return hash
    .split('')
    .map((char) => {
      const code = parseInt(char, 16);
      return String.fromCharCode('a'.charCodeAt(0) + code);
    })
    .join('');
}

export function ensureSigningKey(destinationPath = keyPath) {
  if (fs.existsSync(destinationPath)) {
    const existingPem = fs.readFileSync(destinationPath, 'utf8');
    const publicKeyObject = crypto.createPublicKey(existingPem);
    const publicKeyDer = publicKeyObject.export({ type: 'spki', format: 'der' });
    const publicKeyBase64 = publicKeyDer.toString('base64');
    const extensionId = computeExtensionId(publicKeyDer);

    return {
      created: false,
      keyPath: destinationPath,
      extensionId,
      publicKeyBase64
    };
  }

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'der'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  fs.writeFileSync(destinationPath, privateKey, { encoding: 'utf8', mode: 0o600 });

  const publicKeyBase64 = publicKey.toString('base64');
  const extensionId = computeExtensionId(publicKey);

  return {
    created: true,
    keyPath: destinationPath,
    extensionId,
    publicKeyBase64
  };
}

function runKeyGeneration() {
  const result = ensureSigningKey();
  if (result.created) {
    console.log(`Generated new persistent RSA 2048 signing key: ${result.keyPath}`);
  } else {
    console.log(`Loaded existing persistent signing key: ${result.keyPath}`);
  }
  console.log(`Persistent Extension ID: ${result.extensionId}`);
  console.log(`Public Key (SPKI Base64):\n${result.publicKeyBase64}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runKeyGeneration();
}
