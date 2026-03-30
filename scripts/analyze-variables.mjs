#!/usr/bin/env node
/**
 * Analyze variables catalog vs resolver coverage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read variablesCatalog.ts
const catalogPath = path.join(__dirname, '../src/lib/variablesCatalog.ts');
const catalogContent = fs.readFileSync(catalogPath, 'utf8');

// Extract all canonicalKeys from catalog by parsing v() calls
// Pattern: v("category", "canonicalKey", ...)
const vCallRegex = /v\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,/g;
const catalogKeys = [];
let match;
while ((match = vCallRegex.exec(catalogContent)) !== null) {
  const canonical = match[2]; // e.g. "entrada.tipo"
  catalogKeys.push(`{{${canonical}}}`); // e.g. "{{entrada.tipo}}"
}

console.log(`Total variables in catalog: ${catalogKeys.length}`);

// Read resolveProposalVariables.ts
const resolverPath = path.join(__dirname, '../src/lib/resolveProposalVariables.ts');
const resolverContent = fs.readFileSync(resolverPath, 'utf8');

// Extract all resolved keys from resolver (pattern: if (key === "something")
const resolverRegex = /if\s*\(\s*key\s*===\s*"([^"]+)"\s*\)/g;
const resolvedKeys = new Set();
while ((match = resolverRegex.exec(resolverContent)) !== null) {
  resolvedKeys.add(match[1]); // e.g. "entrada.tipo"
}

console.log(`Unique keys resolved in resolver: ${resolvedKeys.size}`);

// Convert canonicalKeys to dotted keys (without {{ }})
const catalogDottedKeys = catalogKeys.map(k => k.replace(/^\{\{/, '').replace(/\}\}$/, ''));

// Find catalog keys not resolved
const missing = catalogDottedKeys.filter(k => !resolvedKeys.has(k));
console.log(`\nCatalog keys NOT resolved in resolver (${missing.length}):`);
missing.forEach(k => console.log(`  - ${k}`));

// Find resolved keys not in catalog (maybe legacy or extra)
const resolvedArray = Array.from(resolvedKeys);
const extra = resolvedArray.filter(k => !catalogDottedKeys.includes(k));
console.log(`\nResolved keys NOT in catalog (${extra.length}):`);
extra.slice(0, 30).forEach(k => console.log(`  - ${k}`));
if (extra.length > 30) console.log(`  ... and ${extra.length - 30} more`);

// Check for duplicate canonical keys in catalog
const keyCount = {};
catalogDottedKeys.forEach(k => keyCount[k] = (keyCount[k] || 0) + 1);
const duplicates = Object.entries(keyCount).filter(([k, count]) => count > 1);
console.log(`\nDuplicate canonical keys in catalog (${duplicates.length}):`);
duplicates.forEach(([k, count]) => console.log(`  - ${k}: ${count} times`));

// Check for empty labels/descriptions in catalog
const labelRegex = /label:\s*"([^"]*)"/g;
const labels = [];
while ((match = labelRegex.exec(catalogContent)) !== null) {
  labels.push(match[1]);
}
const emptyLabels = labels.filter(l => l.trim() === '');
console.log(`\nEmpty labels in catalog: ${emptyLabels.length}`);

// Check for empty descriptions
const descRegex = /description:\s*"([^"]*)"/g;
const descriptions = [];
while ((match = descRegex.exec(catalogContent)) !== null) {
  descriptions.push(match[1]);
}
const emptyDescs = descriptions.filter(d => d.trim() === '');
console.log(`Empty descriptions in catalog: ${emptyDescs.length}`);

// Check for empty units (allowed: "-" or "")
const unitRegex = /unit:\s*"([^"]*)"/g;
const units = [];
while ((match = unitRegex.exec(catalogContent)) !== null) {
  units.push(match[1]);
}
const emptyUnits = units.filter(u => u.trim() === '' || u === '-');
console.log(`Empty units in catalog: ${emptyUnits.length}`);

// Check for empty examples
const exampleRegex = /example:\s*"([^"]*)"/g;
const examples = [];
while ((match = exampleRegex.exec(catalogContent)) !== null) {
  examples.push(match[1]);
}
const emptyExamples = examples.filter(e => e.trim() === '');
console.log(`Empty examples in catalog: ${emptyExamples.length}`);

// Check for variables with notImplemented flag
const notImplementedRegex = /notImplemented:\s*true/g;
let notImplementedCount = 0;
while (notImplementedRegex.exec(catalogContent) !== null) {
  notImplementedCount++;
}
console.log(`Variables marked as notImplemented: ${notImplementedCount}`);

// Summary
console.log('\n=== SUMMARY ===');
console.log(`Catalog variables: ${catalogKeys.length}`);
console.log(`Resolved keys: ${resolvedKeys.size}`);
console.log(`Missing in resolver: ${missing.length}`);
console.log(`Extra in resolver: ${extra.length}`);
console.log(`Duplicate keys: ${duplicates.length}`);
console.log(`Empty labels: ${emptyLabels.length}`);
console.log(`Not implemented: ${notImplementedCount}`);

if (missing.length > 0) {
  console.log('\n⚠️  WARNING: Some catalog variables are not resolved in the resolver.');
  console.log('   This may cause missing data in generated proposals.');
}