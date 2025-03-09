void !function () {
  class Raw {
    constructor(type, value) {
      this.type = type;
      this.value = value;
    }
  }
  class RawPath {
    constructor() {
      this.shape = [];
      this.cursor = {
        // Moves to the sx and sy coords.
        goto: (x, y) => this.shape.push('M${', x, '},${', y, '} '),
        // Chages the cx and cy by the dx and dy.
        move: (dx, dy) => this.shape.push('m${', dx, '},${', dy, '} '),
      };
      this.line = {
        // Draws to the cx and cy plus dx and dy.
        to: (dx, dy) => this.shape.push('l${', dx, '},${', dy, '} '),
        // Draws like "to" but with dx as 0.
        vertical: (d) => this.shape.push('v${', d, '} '),
        // Draws like "to" but with dy as 0.
        horizontal: (d) => this.shape.push('h${', d, '} '),
        absolute: {
          // Draws from the cx and cy to the sx and sy.
          to: (x, y) => this.shape.push('L${', x, '},${', y, '} '),
          // Draws from the cx and cy to cx and sy.
          vertical: (y) => this.shape.push('V${', y, '} '),
          // Draws from the cx and cy to sx and cy.
          horizontal: (x) => this.shape.push('H${', x, '} '),
        },
      };
      this.curves = {
        quadratic: {
          // Draws from cx and cy to ex and ey and bases on ctx and cty
          absolute: (ctx, cty, ex, ey) => this.shape.push('Q${', ctx, '},${', cty, '} ${', ex, '},${', ey, '} '),
          // Draws from cx and cy to cx and cy plus dx and dy and bases on ctx and cty
          relative: (ctx, cty, dx, dy) => this.shape.push('q${', ctx, '},${', cty, '} ${', dx, '},${', dy, '} '),
          // Continues to cx and cy plus dx and dy.
          continue: (dx, dy) => this.shape.push('t${', dx, '},${', dy, '} '),
          // Continues to the specified ex and ey.
          absoluteContinue: (ex, ey) => this.shape.push('T${', ex, '},${', ey, '} '),
        },
        cubic: {
          // Draws from cx and cy to ex and ey and bases on the points (ctx1, cty1) and (ctx2, cty2)
          absolute: (ctx1, cty1, ctx2, cty2, ex, ey) => this.shape.push('C${', ctx1, '},${', cty1, '} ${', ctx2, '},${', cty2, '} ${', ex, '},${', ey, '} '),
          // Draws from cx and cy to cx and cy plus dx and dy and bases on the points (ctx1, cty1) and (ctx2, cty2)
          relative: (ctx1, cty1, ctx2, cty2, dx, dy) => this.shape.push('c${', ctx1, '},${', cty1, '} ${', ctx2, '},${', cty2, '} ${', dx, '},${', dy, '} '),
          // Continues to cx and cy plus dx and dy with cd2 using (ctx2, cty2).
          continue: (ctx2, cty2, dx, dy) => this.shape.push('s${', ctx2, '},${', cty2, '} ${', dx, '},${', dy, '} '),
          // Continues to the specified ex and ey with cd2 using (ctx2, cty2).
          absoluteContinue: (ctx2, cty2, ex, ey) => this.shape.push('S${', ctx2, '},${', cty2, '} ${', ex, '},${', ey, '} '),
        },
        arc: {
          // rx ry rotation large-arc-flag sweep-flag x y
          // https://www.nan.fyi/svg-paths/arcs
          absolute: (rdx, rdy, rx, largeArc, sweep, ex, ey) => this.shape.push('A${', rdx, '} ${', rdy, '} ${', rx, '} ${', largeArc, '} ${', sweep, '} ${', ex, '},${', ey, '} '),
          relative: (rdx, rdy, rx, largeArc, sweep, dx, dy) => this.shape.push('a${', rdx, '} ${', rdy, '} ${', rx, '} ${', largeArc, '} ${', sweep, '} ${', dx, '},${', dy, '} '),
        },
      };
    }
    toString() {
      return `\`${this.shape.join('').trim()}\``;
    }
  }
  Blockly.Shpr.BabelFramework = class BabelFramework {
    static PathBuilders = new Set([
      'cursor.goto',
      'cursor.move',
      'line.to',
      'line.vertical',
      'line.horizontal',
      'line.absolute.to',
      'line.absolute.vertical',
      'line.absolute.horizontal',
      'curves.quadratic.absolute',
      'curves.quadratic.relative',
      'curves.quadratic.continue',
      'curves.quadratic.continueAbsolute',
      'curves.cubic.absolute',
      'curves.cubic.relative',
      'curves.cubic.continue',
      'curves.cubic.continueAbsolute',
      'arc.absolute',
      'arc.relative',
    ]);
    static exports = { Raw, RawPath };
    constructor() {
      this.factory = this;
      this.SKIP = true;

      this.builder = new RawPath();
      this.steps = [];
    }
    pushCommand(command, ...args) {
      this.steps.push([command, args]);
    }
    binaryExpr(op, a, b) {
      return new Raw('binaryExpr', { op, a, b });
    }
    GRID_UNIT() {
      return new Raw('GRID_UNIT', 'Blockly.BlockSvg.GRID_UNIT');
    }
    edgeShapeWidth_() {
      return new Raw('edgeShapeWidth_', 'this.edgeShapeWidth_');
    }
    readArg(arg) {
      if (arg instanceof Raw) {
        switch(arg.type) {
          case 'binaryExpr': return `(${this.readArg(arg.value.a)} ${arg.value.op} ${this.readArg(arg.value.b)})`;
          case 'GRID_UNIT':
          case 'edgeShapeWidth_': return arg.value;
        }
      }
      return arg.valueOf();
    }
    toString() {
      for (let i = this.steps.length - 1; i > -1; --i) {
        const [command, args] = this.steps.shift();
        if (!this.constructor.PathBuilders.has(command)) continue;
        const step = goog.object.getValueByKeys(this.builder, command.split('.'));
        step.apply(this.builder, args.map(this.readArg, this));
      }
      return this.builder.toString();
    }
  };
}();