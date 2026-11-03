#!/usr/bin/env node
// scripts/audit_ejercicios.js
// Wrapper Node.js para ejecutar la suite de auditoría de ejercicios

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pyScript = join(__dirname, 'audit_ejercicios.py');
const args = process.argv.slice(2);

const child = spawn('python3', [pyScript, ...args], { stdio: 'inherit' });

child.on('close', (code) => {
  process.exit(code || 0);
});
