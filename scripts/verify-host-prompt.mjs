import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { rewritePromptAssembly, CWD_ONLY_SUFFIX } from '../lib/identity.js';

const archive = process.argv[2];
if (!archive) throw new Error('Usage: node scripts/verify-host-prompt.mjs <app.asar-or-host-system-prompt-index.js>');

// Read the installed host renderer without extracting or changing the application.
let source;
if (archive.endsWith('.js')) {
  source = fs.readFileSync(archive, 'utf8');
} else {
const fd = fs.openSync(archive, 'r');
try {
  const prefix = Buffer.alloc(16);
  fs.readSync(fd, prefix, 0, 16, 0);
  const jsonSize = prefix.readUInt32LE(12);
  assert.ok(jsonSize > 0 && jsonSize < 64 * 1024 * 1024, 'Unexpected ASAR header size');
  const header = Buffer.alloc(jsonSize);
  fs.readSync(fd, header, 0, header.length, 16);
  let entry = JSON.parse(header.toString());
  for (const name of 'dsh/node_modules/@deepseek-ai/dsh-system-prompt/lib/index.js'.split('/')) entry = entry.files?.[name];
  assert.ok(entry && !entry.unpacked && entry.size > 0, 'Host prompt renderer not found inside ASAR');
  const body = Buffer.alloc(entry.size);
  fs.readSync(fd, body, 0, body.length, 8 + prefix.readUInt32LE(4) + Number(entry.offset));
  source = body.toString();
} finally { fs.closeSync(fd); }
}

const start = source.indexOf('const VARIABLE_NAME =');
const end = source.indexOf('function resolveContext(');
assert.ok(start >= 0 && end > start, 'Unsupported host renderer layout');
const renderPrompt = vm.runInNewContext(source.slice(start, end) + '\nrenderPrompt;', {}, { timeout: 1000 });
const input = {
  sections: [{ name: 'deployment:persona-suffix', text: CWD_ONLY_SUFFIX }],
  contexts: [], tools: [], variables: { provider: 'example', model: 'example-model' },
};
assert.throws(() => renderPrompt(input), /unknown prompt variable "\{\{cwd\}\}"/);
for (const cwd of ['/work/one', '/work/two', 'E:\\浮空岛\\项目', undefined]) {
  const output = rewritePromptAssembly(input, '', {
    capabilityProtocol: false,
    context: { agent: { session: { header: { cwd } } } },
  });
  assert.ok(renderPrompt(output).includes(`Your working directory is ${cwd ?? ''}.`));
}
const bad = rewritePromptAssembly({ ...input, sections: [{ name: 'custom', text: '{{missing}}' }] }, '', { capabilityProtocol: false });
assert.throws(() => renderPrompt(bad), /unknown prompt variable "\{\{missing\}\}"/);
console.log('PASS: original cwd failure reproduced; fixed prompts render with the installed host renderer.');
console.log('PASS: separate sessions, Unicode paths, missing cwd, and unknown-variable validation.');
