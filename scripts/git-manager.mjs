import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import git from 'isomorphic-git';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const author = {
  name: 'Antigravity Architect',
  email: 'architect@gcc.internal',
};

export async function gitInit() {
  const gitDir = path.join(rootDir, '.git');
  if (!fs.existsSync(gitDir)) {
    await git.init({ fs, dir: rootDir, defaultBranch: 'main' });
    console.log('Initialized clean Git repository at', rootDir);
  }
}

export async function gitCommitAll(message, version = 'v1.0.0') {
  await gitInit();

  // Recursively add all non-ignored files
  async function stageDirectory(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

      // Skip ignored paths
      if (
        relPath.startsWith('node_modules') ||
        relPath.includes('/node_modules') ||
        relPath.startsWith('.git') ||
        relPath.startsWith('dist') ||
        relPath.includes('/dist') ||
        relPath.endsWith('.sqlite') ||
        relPath.endsWith('.db')
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        await stageDirectory(fullPath);
      } else {
        await git.add({ fs, dir: rootDir, filepath: relPath });
      }
    }
  }

  await stageDirectory(rootDir);

  const formattedMsg = `${message}\n\n[Version: ${version}] [Date: ${new Date().toISOString()}]`;
  const sha = await git.commit({
    fs,
    dir: rootDir,
    author,
    message: formattedMsg,
  });

  console.log(`Committed successfully: [${sha.substring(0, 7)}] ${message}`);
  return sha;
}

export async function gitLog() {
  await gitInit();
  const commits = await git.log({ fs, dir: rootDir, depth: 10 });
  return commits.map((c) => ({
    oid: c.oid.substring(0, 7),
    message: c.commit.message.split('\n')[0],
    date: new Date(c.commit.author.timestamp * 1000).toISOString(),
    author: `${c.commit.author.name} <${c.commit.author.email}>`,
  }));
}

// CLI execution
if (process.argv[1]?.endsWith('git-manager.mjs')) {
  const command = process.argv[2] || 'commit';
  const msg = process.argv[3] || 'chore(sync): automated repository checkpoint';

  if (command === 'init') {
    gitInit().then(() => console.log('Git initialized.'));
  } else if (command === 'commit') {
    gitCommitAll(msg).then(() => {
      gitLog().then((logs) => {
        console.log('Recent Git History:');
        console.table(logs);
      });
    });
  } else if (command === 'log') {
    gitLog().then((logs) => console.table(logs));
  }
}
