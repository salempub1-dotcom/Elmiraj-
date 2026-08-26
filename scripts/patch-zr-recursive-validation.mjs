import fs from 'node:fs';

const file = 'lib/deliveryProviders.js';
let s = fs.readFileSync(file, 'utf8');

const oldBlock = `function safeMessage(data, fallback) {
  if (!data || typeof data !== 'object') return fallback;
  const errors = data.errors && typeof data.errors === 'object' ? data.errors : null;
  if (errors) {
    const details = Object.entries(errors)
      .flatMap(([field, messages]) => {
        const list = Array.isArray(messages) ? messages : [messages];
        return list.filter(Boolean).map((message) => \`${'${field}'}: ${'${String(message)}'}\`);
      })
      .slice(0, 8)
      .join(' | ');
    if (details) return details.slice(0, 900);
  }
  return String(data.message || data.detail || data.title || fallback).slice(0, 900);
}`;

const newBlock = `function flattenValidationErrors(value, path = '', out = [], depth = 0) {
  if (out.length >= 12 || depth > 8 || value === null || value === undefined) return out;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim();
    if (text) out.push(path ? \`${'${path}'}: ${'${text}'}\` : text);
    return out;
  }
  if (Array.isArray(value)) {
    value.slice(0, 12).forEach((child, index) => {
      const next = path ? \`${'${path}'}[${'${index}'}]\` : \`[${'${index}'}]\`;
      flattenValidationErrors(child, next, out, depth + 1);
    });
    return out;
  }
  if (typeof value === 'object') {
    Object.entries(value).slice(0, 20).forEach(([key, child]) => {
      const next = path ? \`${'${path}'}.${'${key}'}\` : key;
      flattenValidationErrors(child, next, out, depth + 1);
    });
  }
  return out;
}

function safeMessage(data, fallback) {
  if (!data || typeof data !== 'object') return fallback;
  if (data.errors && typeof data.errors === 'object') {
    const details = flattenValidationErrors(data.errors).slice(0, 10).join(' | ');
    if (details) return details.slice(0, 1400);
  }
  const direct = data.message || data.detail || data.title;
  if (direct && typeof direct !== 'object') return String(direct).slice(0, 1400);
  const body = flattenValidationErrors(data).slice(0, 8).join(' | ');
  return body ? body.slice(0, 1400) : fallback;
}`;

if (!s.includes(oldBlock)) {
  throw new Error('Expected safeMessage block not found; aborting to avoid unsafe patch.');
}
s = s.replace(oldBlock, newBlock);
fs.writeFileSync(file, s);
console.log('ZR nested validation error formatter installed.');
