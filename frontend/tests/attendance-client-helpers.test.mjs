import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/attendance-client-helpers.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const helpers = context.exports;

test('maps every backend attendance error code to its Uzbek message', () => {
  const expected = {
    already_checked_in: 'Davomat allaqachon tasdiqlangan.',
    code_expired: 'Kod muddati tugagan. Ustozdan yangi kodni so‘rang.',
    code_invalid: 'Kod noto‘g‘ri. Belgilarni tekshirib, qayta kiriting.',
    session_not_active: 'Davomat sessiyasi faol emas yoki vaqti tugagan.',
    not_enrolled: 'Siz ushbu dars guruhiga biriktirilmagansiz.',
    rate_limited: 'Urinishlar ko‘p. Bir daqiqadan keyin qayta urinib ko‘ring.',
  };
  for (const [code, message] of Object.entries(expected)) {
    assert.equal(helpers.getAttendanceErrorMessage({ code }), message);
  }
});

test('preserves generic API messages when there is no attendance error code', () => {
  assert.equal(helpers.getAttendanceErrorMessage(new Error('Network unavailable')), 'Network unavailable');
  assert.match(helpers.getAttendanceErrorMessage(null), /Davomatni tasdiqlab bo‘lmadi/);
});

test('normalizes manual codes and removes ambiguous or unsupported characters', () => {
  assert.equal(helpers.normalizeAttendanceCode('ab0o1i!c3'), 'ABC3');
  assert.equal(helpers.normalizeAttendanceCode('abcdefghjklmnopq'), 'ABCDEFGH');
});

test('automatically routes iOS to QR/manual fallback even when browser APIs exist', () => {
  assert.equal(helpers.getUltrasoundFallback({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1',
    isSecureContext: true,
    hasGetUserMedia: true,
    hasAudioContext: true,
  }), 'ios');
});

test('routes insecure and unsupported browser contexts to QR/manual fallback', () => {
  const base = { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0 Safari/537.36', hasGetUserMedia: true, hasAudioContext: true };
  assert.equal(helpers.getUltrasoundFallback({ ...base, isSecureContext: false }), 'insecure');
  assert.equal(helpers.getUltrasoundFallback({ ...base, isSecureContext: true, hasAudioContext: false }), 'unsupported');
  assert.equal(helpers.getUltrasoundFallback({ ...base, isSecureContext: true }), null);
});

test('separates camera denial, dismissed prompt, missing device, and insecure context', () => {
  const base = { isSecureContext: true, hasGetUserMedia: true };
  assert.equal(helpers.classifyCameraIssue({ ...base, errorName: 'NotAllowedError', permissionState: 'denied' }), 'denied');
  assert.equal(helpers.classifyCameraIssue({ ...base, errorName: 'NotAllowedError', permissionState: 'prompt' }), 'dismissed');
  assert.equal(helpers.classifyCameraIssue({ ...base, errorName: 'NotFoundError' }), 'no_device');
  assert.equal(helpers.classifyCameraIssue({ ...base, isSecureContext: false }), 'insecure');
});

test('shows browser-specific camera steps and only exposes reported track controls', () => {
  assert.match(helpers.getCameraHelp('denied', 'Safari').steps.join(' '), /Settings → Apps → Safari/);
  assert.match(helpers.getCameraHelp('denied', 'Samsung').steps.join(' '), /Samsung|Permissions|Camera/i);
  assert.deepEqual(helpers.supportsCameraControls({ torch: true, facingMode: ['user', 'environment'] }), { torch: true, switchCamera: true });
  assert.deepEqual(helpers.supportsCameraControls({ torch: false, facingMode: ['environment'] }), { torch: false, switchCamera: false });
});

test('classifies ultrasound timeout conditions for actionable retry messages', () => {
  assert.equal(helpers.classifyUltrasoundSignal({ maxSignalDb: -95, backgroundDb: -55, preambleSeen: false }), 'low_volume');
  assert.equal(helpers.classifyUltrasoundSignal({ maxSignalDb: -60, backgroundDb: -20, preambleSeen: false }), 'noise');
  assert.equal(helpers.classifyUltrasoundSignal({ maxSignalDb: -70, backgroundDb: -58, preambleSeen: true }), 'timeout');
});

test('reports only coarse browser and OS labels', () => {
  assert.deepEqual(helpers.getClientEnvironment('Mozilla/5.0 (Linux; Android 14) SamsungBrowser/27.0 Chrome/130.0', 'Linux armv8l'), { browser: 'Samsung', os: 'Android' });
  assert.deepEqual(helpers.getClientEnvironment('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1'), { browser: 'Safari', os: 'iOS' });
});
