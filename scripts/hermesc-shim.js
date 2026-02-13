#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const outFlagIndex = args.indexOf('-out');

if (outFlagIndex === -1 || outFlagIndex + 2 >= args.length) {
  console.error('hermesc-shim: invalid arguments');
  process.exit(1);
}

const outFile = path.resolve(process.cwd(), args[outFlagIndex + 1]);
const inputFile = path.resolve(process.cwd(), args[outFlagIndex + 2]);

if (!fs.existsSync(inputFile)) {
  console.error(`hermesc-shim: input not found: ${inputFile}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.copyFileSync(inputFile, outFile);
