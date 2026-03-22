#!/usr/bin/env node

'use strict';

const { run } = require('../src/index.js');

run(process.argv.slice(2)).catch(err => {
  process.stderr.write(`\x1b[31mError: ${err.message}\x1b[0m\n`);
  process.exit(1);
});
