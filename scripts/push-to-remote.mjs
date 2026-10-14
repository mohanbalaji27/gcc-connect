import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export async function pushToRemote(remoteUrl, token) {
  if (!remoteUrl) {
    console.error('Usage: node scripts/push-to-remote.mjs <remote-git-url> [personal-access-token]');
    process.exit(1);
  }

  console.log(`Pushing 'main' branch to ${remoteUrl}...`);

  try {
    // Add remote if not exists
    const remotes = await git.listRemotes({ fs, dir: rootDir });
    const hasOrigin = remotes.some((r) => r.remote === 'origin');

    if (hasOrigin) {
      await git.deleteRemote({ fs, dir: rootDir, remote: 'origin' });
    }
    await git.addRemote({ fs, dir: rootDir, remote: 'origin', url: remoteUrl });

    // Push using isomorphic-git
    const pushResult = await git.push({
      fs,
      http,
      dir: rootDir,
      remote: 'origin',
      ref: 'main',
      onAuth: () => ({
        username: token || 'git',
        password: token || '',
      }),
    });

    console.log('Successfully pushed code to remote Git repository!', pushResult);
  } catch (error) {
    console.error('Failed to push to remote:', error);
    process.exit(1);
  }
}

const remote = process.argv[2];
const pat = process.argv[3];
pushToRemote(remote, pat);
