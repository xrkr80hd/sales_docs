const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function field(initial, parse = Number) {
  let draft = null, value = initial, saved;
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/ui/number-input.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports,
    require(name) {
      if (name === 'react') return { useState: () => [draft, next => { draft = next; }] };
      if (name === 'react/jsx-runtime') return { jsx: (_, props) => props };
      throw Error(name);
    },
  });
  const render = () => exports.NumberInput({ value, onChange: e => { value = parse(e.currentTarget.value); }, onBlur: () => { saved = value; } });
  return { render, type(text) { const input = { value: text }; render().onChange({ currentTarget: input }); return input.value; }, get value() { return value; }, get saved() { return saved; } };
}
test('zero can be cleared and replaced with a twelve-sale objective without a forced digit', () => {
  const f = field(0, n => Math.max(1, Number(n)));
  f.type(''); assert.equal(f.render().value, '');
  f.type('1'); f.type('12'); assert.equal(f.render().value, '12'); assert.equal(f.value, 12);
  f.render().onBlur({}); assert.equal(f.saved, 12); assert.equal(f.render().value, 12);
});
test('gross input removes leading zeros during editing and saves 320000', () => {
  const f = field(0);
  assert.equal(f.type('0320000'), '320000'); assert.equal(f.render().value, '320000');
  f.render().onBlur({}); assert.equal(f.saved, 320000);
});
test('decimal gross remains editable with a real zero before the decimal', () => {
  const f = field(0);
  f.type('0.'); assert.equal(f.render().value, '0.');
  f.type('0.50'); assert.equal(f.render().value, '0.50'); assert.equal(f.value, 0.5);
  f.type('000320.50'); assert.equal(f.render().value, '320.50'); assert.equal(f.value, 320.5);
});
test('clearing a manager amount preserves the empty draft then restores numeric zero on blur', () => {
  const f = field(320000); f.type(''); assert.equal(f.render().value, '');
  f.render().onBlur({}); assert.equal(f.render().value, 0); assert.equal(f.saved, 0);
});
