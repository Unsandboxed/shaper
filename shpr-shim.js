/**
* @fileoverview Shaper API
*/

/**
* @name Blockly.Shpr
* @namespace
**/
goog.provide('Blockly.Shpr');

Blockly.Shpr = {};

Blockly.Shpr.Path = function Path(path) {
  'use strict';
  this._path = (path instanceof this.constructor ? path.toArray() : Array.from((path ?? '').match(/-?(?:\d*\.)?\d+|[a-z]/gi)));
  this.toString = function() {
    return this._path.join(' ');
  };
  this.push = this._path.push.bind(this._path);
  this.shift = this._path.shift.bind(this._path);
  Object.defineProperty(this, 'length', {
    get: () => {
      return this._path.length;
    },
  });
}
Blockly.Shpr.Path.prototype.length = 0;
Blockly.Shpr.Path.prototype.item = function(n) {
  return this._path[n];
}
Blockly.Shpr.Path.prototype.toArray = function() {
  return this._path;
};
Blockly.Shpr.Path.prototype.toShapeJS = function() {
  return Blockly.Shpr.Path.toShapeJS(this.toString());
};
Blockly.Shpr.Path.toShapeJS = function(path) {
  let js = `const UnknownShape = new PathBuilder();\n`;
  let cmds = new this(path).toArray(),
    cnt = cmds.length;
  function shiftNum(l, h) {
    const n = Number(cmds.shift());
    if (isNaN(n)) throw new Error('Got invalid number.');
    if (h && n > h) throw new Error('Number to high.');
    if (l && n < l) throw new Error('Number to low.');
    return n;
  }
  const shiftNc = (c) => {
    let args = '';
    for (let i = 0; i < c; i++) {
      args += shiftNum();
      if (i < c - 1) args += ', ';
    }
    return args;
  };
  for (let i = 0; i < cnt; i++) {
    const command = cmds.shift();
    if (!command || command.length < 0) continue;
    switch (command) {
      case 'M':
        js += `UnknownShape.cursor.goto(${shiftNc(2)});\n`;
        i += 2;
        break;
      case 'm':
        js += `UnknownShape.cursor.move(${shiftNc(2)});\n`;
        i += 2;
        break;
      case 'L':
        js += `UnknownShape.line.absolute.to(${shiftNc(2)});\n`;
        i += 2;
        break;
      case 'l':
        js += `UnknownShape.line.to(${shiftNc(2)});\n`;
        i += 2;
        break;
      case 'V':
        js += `UnknownShape.line.absolute.vertical(${shiftNum()});\n`;
        i++;
        break;
      case 'v':
        js += `UnknownShape.line.vertical(${shiftNum()});\n`;
        i++;
        break;
      case 'H':
        js += `UnknownShape.line.absolute.horizontal(${shiftNum()});\n`;
        i++;
        break;
      case 'h':
        js += `UnknownShape.line.horizontal(${shiftNum()});\n`;
        i++;
        break;
      case 'Q':
        js += `UnknownShape.curves.quadratic.absolute(${shiftNc(4)});\n`;
        i += 4;
        break;
      case 'q':
        js += `UnknownShape.curves.quadratic.relative(${shiftNc(4)});\n`;
        i += 4;
        break;
      case 'T':
        js += `UnknownShape.curves.quadratic.absoluteContinue(${shiftNc(4)});\n`;
        i += 4;
        break;
      case 't':
        js += `UnknownShape.curves.quadratic.continue(${shiftNc(4)});\n`;
        i += 4;
        break;
      case 'C':
        js += `UnknownShape.curves.cubic.absolute(${shiftNc(6)});\n`;
        i += 6;
        break;
      case 'c':
        js += `UnknownShape.curves.cubic.relative(${shiftNc(6)});\n`;
        i += 6;
        break;
      case 'S':
        js += `UnknownShape.curves.cubic.absoluteContinue(${shiftNc(4)});\n`;
        i += 4;
        break;
      case 's':
        js += `UnknownShape.curves.cubic.continue(${shiftNc(4)});\n`;
        i += 4;
        break;
      case 'A':
        js += `UnknownShape.curves.arc.absolute(${shiftNc(3)}, ${shiftNum(0, 1)}, ${shiftNum(0, 1)}, ${shiftNc(2)});\n`;
        i += 7;
        break;
      case 'a':
        js += `UnknownShape.curves.arc.relative(${shiftNc(3)}, ${shiftNum(0, 1)}, ${shiftNum(0, 1)}, ${shiftNc(2)});\n`;
        i += 7;
        break;
      case 'Z':
      case 'z':
        js += `UnknownShape.closePath();`;
        break;
      default:
        console.log(command);
        throw new Error('Unknown command.');
    }
  }
  return js;
};
Blockly.Shpr.PathBuilder = function PathBuilder() {
  'use strict';
  /**!
     -- Mappings:
      M: cursor.goto, m: cursor.move
      L: line.absolute.to, l: line.to
      V: line.absolute.vertical, v: line.vertical
      H: line.absolute.horizontal, h: line.horizontal
      Q: curves.quadratic.absolute, q: curves.quadratic.relative
      T: curves.quadratic.absoluteContinue, t: curves.quadratic.continue
      C: curves.cubic.absolute, c: curves.cubic.relative
      S: curves.cubic.absoluteContine, s: curves.cubic.continue
      A: curves.arc.absolute, a: curves.arc.relative
    --
    -- Namings:
      cx: current x, cy: current y
      sx: specified x, sy: specified y
      dx: distance for x, dy: distance for y
      ex: end x, ey: end y
      ctx: control x, cty: control y
      cd: control point
      rx: rotation x, ry: rotation y
      rdx: radius x, rdy: radius y
      rot: rotation
    --
    */
  this.PATH = null;
  let closed = false;
  const shape = new Blockly.Shpr.Path('m0,0');
  this.cursor = {
    // Moves to the sx and sy coords.
    goto: (x, y) => shape.push(`M${x},${y}`),
    // Chages the cx and cy by the dx and dy.
    move: (dx, dy) => shape.push(`m${dx},${dy}`),
  };
  this.line = {
    // Draws to the cx and cy plus dx and dy.
    to: (dx, dy) => shape.push(`l${dx},${dy}`),
    // Draws like "to" but with dx as 0.
    vertical: (d) => shape.push(`v${d}`),
    // Draws like "to" but with dy as 0.
    horizontal: (d) => shape.push(`h${d}`),
    absolute: {
      // Draws from the cx and cy to the sx and sy.
      to: (x, y) => shape.push(`L${x},${y}`),
      // Draws from the cx and cy to cx and sy.
      vertical: (y) => shape.push(`V${y}`),
      // Draws from the cx and cy to sx and cy.
      horizontal: (x) => shape.push(`H${x}`),
    },
  };
  this.curves = {
    quadratic: {
      // Draws from cx and cy to ex and ey and bases on ctx and cty
      absolute: (ctx, cty, ex, ey) => shape.push(`Q${ctx},${cty} ${ex},${ey}`),
      // Draws from cx and cy to cx and cy plus dx and dy and bases on ctx and cty
      relative: (ctx, cty, dx, dy) => shape.push(`q${ctx},${cty} ${dx},${dy}`),
      // Continues to cx and cy plus dx and dy.
      continue: (dx, dy) => shape.push(`t${dx},${dy}`),
      // Continues to the specified ex and ey.
      absoluteContinue: (ex, ey) => shape.push(`T${ex},${ey}`),
    },
    cubic: {
      // Draws from cx and cy to ex and ey and bases on the points (ctx1, cty1) and (ctx2, cty2)
      absolute: (ctx1, cty1, ctx2, cty2, ex, ey) => shape.push(`C${ctx1},${cty1} ${ctx2},${cty2} ${ex},${ey}`),
      // Draws from cx and cy to cx and cy plus dx and dy and bases on the points (ctx1, cty1) and (ctx2, cty2)
      relative: (ctx1, cty1, ctx2, cty2, dx, dy) => shape.push(`c${ctx1},${cty1} ${ctx2},${cty2} ${dx},${dy}`),
      // Continues to cx and cy plus dx and dy with cd2 using (ctx2, cty2).
      continue: (ctx2, cty2, dx, dy) => shape.push(`s${ctx2},${cty2} ${dx},${dy}`),
      // Continues to the specified ex and ey with cd2 using (ctx2, cty2).
      absoluteContinue: (ctx2, cty2, ex, ey) => shape.push(`S${ctx2},${cty2} ${ex},${ey}`),
    },
    arc: {
      // rx ry rotation large-arc-flag sweep-flag x y
      // https://www.nan.fyi/svg-paths/arcs
      absolute: (rdx, rdy, rx, largeArc, sweep, ex, ey) => shape.push(`A${rdx} ${rdy} ${rx} ${Number(largeArc)} ${Number(sweep)} ${ex},${ey}`),
      relative: (rdx, rdy, rx, largeArc, sweep, dx, dy) => shape.push(`a${rdx} ${rdy} ${rx} ${Number(largeArc)} ${Number(sweep)} ${dx},${dy}`),
    },
  };
  // Closing
  this.closePath = function (skipZ, removeM) {
    if (closed) return false;
    skipZ = skipZ || false;
    if (!skipZ) shape.push(`z`);
    if (shape.length > 1) {
      // If the "first" added item by the user is a move command we can remove our automatic nove command
      if (removeM && shape.item(0).at(0).toLowerCase() === 'm') shape.shift();
      if (!removeM && shape.item(1).at(0).toLowerCase() === 'm') shape.shift();
      while (shape.item(0) == 0) {
        shape.shift();
      }
    }
    return (this.PATH = shape);
  };
};
