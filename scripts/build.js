import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureSigningKey } from './generate-key.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..');
const distDir = path.join(rootDir, 'dist');
const unpackedDir = path.join(distDir, 'unpacked');
const manifestPath = path.join(rootDir, 'manifest.json');
const persistentKeyPath = path.join(rootDir, 'kick-monitor.pem');

function readExtensionMetadata() {
  const rawManifest = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(rawManifest);
  return {
    name: 'kick-monitor',
    version: manifest.version || '1.0.0',
    title: manifest.name || 'Kick Monitor'
  };
}

function prepareUnpackedDirectory(publicKeyBase64) {
  if (fs.existsSync(unpackedDir)) {
    fs.rmSync(unpackedDir, { recursive: true, force: true });
  }
  fs.mkdirSync(unpackedDir, { recursive: true });

  const rawManifest = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(rawManifest);
  if (publicKeyBase64) {
    manifest.key = publicKeyBase64;
  }
  fs.writeFileSync(path.join(unpackedDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  const assetsSource = path.join(rootDir, 'assets');
  if (fs.existsSync(assetsSource)) {
    fs.cpSync(assetsSource, path.join(unpackedDir, 'assets'), { recursive: true });
  }

  const srcSource = path.join(rootDir, 'src');
  if (fs.existsSync(srcSource)) {
    fs.cpSync(srcSource, path.join(unpackedDir, 'src'), { recursive: true });
  }
}

function createZipDistribution(zipFilePath) {
  if (fs.existsSync(zipFilePath)) {
    fs.rmSync(zipFilePath, { force: true });
  }

  const tarResult = spawnSync('tar', ['-a', '-c', '-f', zipFilePath, '-C', unpackedDir, '.']);
  if (tarResult.status === 0 && fs.existsSync(zipFilePath)) {
    return true;
  }

  if (os.platform() === 'win32') {
    const pwshCommand = `Compress-Archive -Path '${path.join(unpackedDir, '*')}' -DestinationPath '${zipFilePath}' -Force`;
    const powershellResult = spawnSync('powershell', ['-NoProfile', '-Command', pwshCommand]);
    if (powershellResult.status === 0 && fs.existsSync(zipFilePath)) {
      return true;
    }
  }

  const zipResult = spawnSync('zip', ['-r', zipFilePath, '.'], { cwd: unpackedDir });
  return zipResult.status === 0 && fs.existsSync(zipFilePath);
}

function findChromiumExecutable() {
  const platform = os.platform();
  const candidates = [];

  if (platform === 'win32') {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env['LOCALAPPDATA'] || '';

    candidates.push(
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else {
    candidates.push(
      'google-chrome',
      'google-chrome-stable',
      'chromium',
      'chromium-browser'
    );
  }

  for (const candidate of candidates) {
    if (path.isAbsolute(candidate)) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } else {
      const toolCheck = spawnSync(platform === 'win32' ? 'where' : 'which', [candidate]);
      if (toolCheck.status === 0) {
        return candidate;
      }
    }
  }

  return null;
}

function createCrxDistribution(browserExecutable, crxDestinationPath) {
  const tempProfileDir = path.join(distDir, '.chrome-pack-profile');
  if (fs.existsSync(tempProfileDir)) {
    fs.rmSync(tempProfileDir, { recursive: true, force: true });
  }

  const browserArguments = [
    `--pack-extension=${unpackedDir}`,
    `--user-data-dir=${tempProfileDir}`,
    '--no-message-box'
  ];

  const hasPersistentKey = fs.existsSync(persistentKeyPath);
  if (hasPersistentKey) {
    browserArguments.push(`--pack-extension-key=${persistentKeyPath}`);
  }

  const packProcess = spawnSync(browserExecutable, browserArguments);

  if (fs.existsSync(tempProfileDir)) {
    fs.rmSync(tempProfileDir, { recursive: true, force: true });
  }

  const generatedCrxDefault = path.join(distDir, 'unpacked.crx');
  const generatedPemDefault = path.join(distDir, 'unpacked.pem');

  if (fs.existsSync(generatedCrxDefault)) {
    if (fs.existsSync(crxDestinationPath)) {
      fs.rmSync(crxDestinationPath, { force: true });
    }
    fs.renameSync(generatedCrxDefault, crxDestinationPath);
  }

  if (fs.existsSync(generatedPemDefault)) {
    if (!hasPersistentKey) {
      fs.copyFileSync(generatedPemDefault, persistentKeyPath);
    }
    fs.rmSync(generatedPemDefault, { force: true });
  }

  return packProcess.status === 0 && fs.existsSync(crxDestinationPath);
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kilobytes = (bytes / 1024).toFixed(1);
  return `${kilobytes} KB`;
}

function runBuildPipeline() {
  const { name, version, title } = readExtensionMetadata();
  const zipFileName = `${name}-v${version}.zip`;
  const crxFileName = `${name}-v${version}.crx`;
  const zipFilePath = path.join(distDir, zipFileName);
  const crxFilePath = path.join(distDir, crxFileName);
  const keyInfo = ensureSigningKey(persistentKeyPath);

  console.log(`Building production artifacts for ${title} v${version}...`);

  fs.mkdirSync(distDir, { recursive: true });
  prepareUnpackedDirectory(keyInfo.publicKeyBase64);
  console.log(`[1/3] Prepared clean unpacked folder: ${unpackedDir}`);

  const zipSuccess = createZipDistribution(zipFilePath);
  if (zipSuccess) {
    const zipStats = fs.statSync(zipFilePath);
    console.log(`[2/3] Created distribution ZIP: ${zipFilePath} (${formatBytes(zipStats.size)})`);
  } else {
    throw new Error('Failed to create distribution ZIP archive.');
  }

  const browserPath = findChromiumExecutable();
  if (browserPath) {
    const crxSuccess = createCrxDistribution(browserPath, crxFilePath);
    if (crxSuccess) {
      const crxStats = fs.statSync(crxFilePath);
      console.log(`[3/3] Created packed CRX: ${crxFilePath} (${formatBytes(crxStats.size)})`);
    } else {
      console.warn('[3/3] Warning: Chromium was found but failed to pack .crx.');
    }
  } else {
    console.warn('[3/3] Warning: Chromium browser executable not found. Skipped .crx generation.');
  }

  console.log('\nProduction build complete:');
  console.log(`- Extension ID:       ${keyInfo.extensionId}`);
  console.log(`- Signing Key:        ${keyInfo.keyPath}`);
  console.log(`- Unpacked Directory: ${unpackedDir}`);
  console.log(`- ZIP Distribution:   ${zipFilePath}`);
  if (fs.existsSync(crxFilePath)) {
    console.log(`- CRX Distribution:   ${crxFilePath}`);
  }
}

runBuildPipeline();
