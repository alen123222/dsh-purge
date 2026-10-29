import assert from 'node:assert/strict';
import test from 'node:test';
import { rewritePromptAssembly, CWD_ONLY_SUFFIX } from '../lib/identity.js';

function assembly(variables = { provider: 'example', model: 'example-model' }) {
  return {
    sections: [{ name: 'deployment:persona-suffix', text: CWD_ONLY_SUFFIX }],
    contexts: [], tools: [], variables,
  };
}

function rewrite(input, cwd) {
  return rewritePromptAssembly(input, '', {
    capabilityProtocol: false,
    context: { agent: { session: { header: { cwd } } } },
  });
}

test('provides the current session cwd when the host no longer registers it', () => {
  const output = rewrite(assembly(), '/work/project');
  assert.equal(output.variables.cwd, '/work/project');
  assert.equal(output.variables.provider, 'example');
  assert.equal(output.variables.model, 'example-model');
  assert.equal(output.sections.find(s => s.name === 'deployment:persona-suffix').text, CWD_ONLY_SUFFIX);
});

test('reads cwd independently for each session, including Unicode paths', () => {
  const input = assembly();
  for (const cwd of ['/work/one', '/work/two', 'E:\\浮空岛\\项目']) {
    assert.equal(rewrite(input, cwd).variables.cwd, cwd);
  }
  assert.equal(Object.hasOwn(input.variables, 'cwd'), false);
});

test('preserves an existing host or scoped cwd variable', () => {
  const input = assembly({ cwd: '/host/registered', provider: 'example', model: 'example-model' });
  const output = rewrite(input, '/session/other');
  assert.equal(output.variables, input.variables);
  assert.equal(output.variables.cwd, '/host/registered');
});

test('keeps an explicitly empty host cwd instead of substituting another directory', () => {
  assert.equal(rewrite(assembly({ cwd: '' }), '/session/other').variables.cwd, '');
});

test('uses an empty value when the session has no cwd or no context', () => {
  assert.equal(rewrite(assembly(), undefined).variables.cwd, '');
  assert.equal(rewritePromptAssembly(assembly(), '', { capabilityProtocol: false }).variables.cwd, '');
});

test('does not mutate a reused or frozen input', () => {
  const input = assembly();
  const snapshot = structuredClone(input);
  Object.freeze(input.variables);
  Object.freeze(input.sections[0]);
  Object.freeze(input.sections);
  Object.freeze(input);
  const output = rewrite(input, '/work/frozen');
  assert.notEqual(output, input);
  assert.deepEqual(input, snapshot);
});

test('repeated assembly retains one suffix and the selected cwd', () => {
  const first = rewrite(assembly(), '/work/current');
  const second = rewrite(first, '/work/current');
  assert.equal(second.variables.cwd, '/work/current');
  assert.equal(second.sections.filter(s => s.name === 'deployment:persona-suffix').length, 1);
});

test('preserves unrelated variables and does not invent missing names', () => {
  const input = assembly({ provider: 'example', model: 'example-model', custom: 'keep' });
  const output = rewrite(input, '/work/current');
  assert.equal(output.variables.custom, 'keep');
  assert.equal(Object.hasOwn(output.variables, 'missing'), false);
});
