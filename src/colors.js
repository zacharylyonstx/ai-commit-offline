'use strict';

// Zero-dependency ANSI colors — respects NO_COLOR convention
const enabled = !process.env.NO_COLOR && process.stdout.isTTY !== false;

const code = (open, close) => enabled
  ? s => `\x1b[${open}m${s}\x1b[${close}m`
  : s => s;

module.exports = {
  bold:    code(1, 22),
  dim:     code(2, 22),
  italic:  code(3, 23),
  red:     code(31, 39),
  green:   code(32, 39),
  yellow:  code(33, 39),
  blue:    code(34, 39),
  magenta: code(35, 39),
  cyan:    code(36, 39),
  gray:    code(90, 39),
};
