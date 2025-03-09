void !function () {
  document.body.innerHTML = '';
  Object.freeze(goog);
  Babel.registerPlugin('shpr', function shpr({ types: t }) {
    const isInPathBuilder = (path) => ( path.parent && (
      (
        t.isCallExpression(path.parent, null) &&
        path.parent.callee && t.isIdentifier(path.parent.callee) &&
        path.parent.callee.name === 'factory.pushCommand' ||
        path.parent.callee.name === 'factory.binaryExpr'
      ) || (
        t.isBinaryExpression(path.parent) && isInPathBuilder(path.parent)
      )
    ) );
    return {
      visitor: {
        BinaryExpression(path) {
          if (!isInPathBuilder(path)) return;
          path.replaceWith(t.callExpression(
            t.identifier('factory.binaryExpr'),
            [t.StringLiteral(path.node.operator), path.node.left, path.node.right]
          ));
        },
        Identifier(path) {
          if (path.node.name === 'GRID_UNIT') {
            path.node.name = 'factory.GRID_UNIT()'
          } else if (path.node.name === 'edgeShapeWidth_') {
            path.node.name = 'factory.edgeShapeWidth_()';
          }
        },
        CallExpression(path) {
          const callee = path.get('callee'), command = callee.getSource();
          if (!Blockly.Shpr.BabelFramework.PathBuilders.has(command)) return;
          path.node.arguments.unshift(t.StringLiteral(command));
          callee.replaceWith(t.identifier(`factory.pushCommand`));
        },
      },
    };
  });
  with (goog) {
    Retheme.setTheme = (theme) => {
      if (!Retheme.includes(theme)) return;
      localStorage['retheme-theme'] = theme;
      Retheme.ACTIVE = theme;
      document.querySelector(':root').style.setProperty(
        '--user-theme', `var(--${Retheme.ACTIVE})`
      );
    }
    const hasOwn = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
    Blockly.ContextMenu.show = () => {};
    Blockly.WorkspaceSvg.prototype.showContextMenu_ = () => {};
    Blockly.Extensions.register('output_round', function() {
      this.setOutputShape(Blockly.OUTPUT_SHAPE_ROUND);
    });
    Blockly.Extensions.register('output_null', function() {
      this.setOutput(true, null);
    });

    const INTERNAL_SHAPE = 'internalShape0';
    const SELF_ITEM = Symbol('self');

    class WorkspaceWrapper {
      constructor(node) {
        this.node = node;
        this.ws = null;
      }
      static config = Object.freeze({
        renderer: 'zelos',
        toolbox: {},
        zoom: {
          controls: false,
          wheel: false,
          touch: false,
          startScale: 0.6,
        },
        grid: {
          spacing: 40,
          length: 2,
          colour: '#ddd',
        },
        rtl: false,
        comments: false,
        collapse: false,
        sounds: false,
      });
      refresh() {
        if (this.ws) this.ws.dispose();
        this.node.innerHTML = '';
        this.ws = Blockly.inject(this.node, WorkspaceWrapper.config);
      }
      registerBlocks(json) {
        json = [].concat(json);
        for (let i = 0, block; block = json[i]; ++i) {
          delete Blockly.Blocks[block.type];
          block.extensions = block.extensions ?? [];
          block.extensions.unshift('colours_pen');
          block.extensions.unshift('scratch_extension');
          if (!hasOwn(block, 'previousStatement') && !hasOwn(block, 'nextStatement')) block.output = null;
          Blockly.Blocks[block.type] = {
            init() { return this.jsonInit(block); },
          };
        }
      }
    }

    const generateBlockCombosJSON = (type, outputType) => ([{
      type: `internal_repo_${type}`,
      message0: 'block',
      outputShape: type,
    }, {
      type: `internal_stack_${type}`,
      message0: 'block %1',
      args0: [{
        type: 'input_value',
        name: 'INTERNAL',
        check: type,
      }],
      previousStatement: null,
      nextStatement: null,
      extensions: ['shape_statement'],
    }, {
      type: `internal_repo_${type}_${INTERNAL_SHAPE}`,
      message0: 'block %1',
      args0: [{
        type: 'input_value',
        name: 'INTERNAL',
        check: INTERNAL_SHAPE,
      }],
      extensions: [`output_${outputType}`, 'output_null'],
    }, {
      type: `internal_repo_${type}_1`,
      message0: 'block %1',
      args0: [{
        type: 'input_value',
        name: 'INTERNAL',
        check: 'Boolean',
      }],
      extensions: [`output_${outputType}`, 'output_null'],
    }, {
      type: `internal_repo_${type}_2`,
      message0: 'block %1',
      args0: [{
        type: 'input_value',
        name: 'INTERNAL',
        check: null,
      }],
      extensions: [`output_${outputType}`, 'output_null'],
    }, {
      type: `internal_repo_${type}_3`,
      message0: 'block %1',
      args0: [{
        type: 'input_value',
        name: 'INTERNAL',
        check: 'Array',
      }],
      extensions: [`output_${outputType}`, 'output_null'],
    }, {
      type: `internal_repo_${type}_4`,
      message0: 'block %1',
      args0: [{
        type: 'input_value',
        name: 'INTERNAL',
        check: 'Object',
      }],
      extensions: [`output_${outputType}`, 'output_null'],
    }]);
    const BXML = (type, x, y) => `<block type="${type}" id="${type}" x="${x}" y="${y}"></block>`;

    class ShapeSpace extends WorkspaceWrapper {
      constructor(node) {
        super(node);
        this._querys = {
          inner: null,
          outer: null,
          argument: null,
          left: null,
          right: null,
          width: null,
          name: null,
        };
        this._outputs = {
          usb: null,
          argument: null,
          left: null,
          right: null,
        }
        this.shapeInfo = {
          name: INTERNAL_SHAPE,
          width: 0,
          paddings: {},
          argumentPath: '',
        };
        this.shape = null;
      }
      registerShape() {
        Blockly.CustomShapes.register(INTERNAL_SHAPE, {
          name: INTERNAL_SHAPE,
          getWidth: () => this.shapeInfo.width * Blockly.BlockSvg.GRID_UNIT,
          getInnerPaddingFor: () => 0,
          getOuterPaddingFor: () => 0,
          getLeftPath: this.readSidePath.bind(this, 'left'),
          getRightPath: this.readSidePath.bind(this, 'right'),
          getArgumentPath: () => this.shapeInfo.argumentPath,
          outputExtension(_, blockSVG) {
            blockSVG.setInputsInline(true);
            blockSVG.setOutputShape(INTERNAL_SHAPE);
            blockSVG.setOutput(true, INTERNAL_SHAPE);
          },
        }, null);
        this.shape = Blockly.CustomShapes.ALL_[INTERNAL_SHAPE];
        this.writePaddings();
      }
      writePaddings() {
        const getInnerPad = ((type) => +this._querys.inner.queryItem(type).nextElementSibling.querySelector('input').value * Blockly.BlockSvg.GRID_UNIT);
        const getOuterPad = ((type) => +this._querys.outer.queryItem(type).nextElementSibling.querySelector('input').value * Blockly.BlockSvg.GRID_UNIT);
        
        this.shapeInfo.paddings = {
          inner: {
            [this.shapeInfo.name]: getInnerPad(SELF_ITEM),
            [0]: getInnerPad(0),
            [Blockly.OUTPUT_SHAPE_HEXAGONAL]: getInnerPad(Blockly.OUTPUT_SHAPE_HEXAGONAL),
            [Blockly.OUTPUT_SHAPE_ROUND]: getInnerPad(Blockly.OUTPUT_SHAPE_ROUND),
            [Blockly.OUTPUT_SHAPE_SQUARE]: getInnerPad(Blockly.OUTPUT_SHAPE_SQUARE),
            [Blockly.OUTPUT_SHAPE_OBJECT]: getInnerPad(Blockly.OUTPUT_SHAPE_OBJECT),
          },
          outer: {
            [this.shapeInfo.name]: getOuterPad(SELF_ITEM),
            [0]: getInnerPad(0),
            [Blockly.OUTPUT_SHAPE_HEXAGONAL]: getOuterPad(Blockly.OUTPUT_SHAPE_HEXAGONAL),
            [Blockly.OUTPUT_SHAPE_ROUND]: getOuterPad(Blockly.OUTPUT_SHAPE_ROUND),
            [Blockly.OUTPUT_SHAPE_SQUARE]: getOuterPad(Blockly.OUTPUT_SHAPE_SQUARE),
            [Blockly.OUTPUT_SHAPE_OBJECT]: getOuterPad(Blockly.OUTPUT_SHAPE_OBJECT),
          },
        };
        this.shape.paddings = this.shapeInfo.paddings;
        Blockly.CustomShapes.updatePaddings(this.shapeInfo);
      }
      readSidePath(shape, blockSVG, steps) {
        if (!this._querys[shape]) return (console.warn('Unknown shape', shape), steps);
        const factory = execute(this._querys[shape].value, {
          edgeShapeWidth_: blockSVG.edgeShapeWidth_,
        });
        factory.closePath(true, true);
        steps.push(factory.PATH.toString());
        return steps;
      }
      refreshShape() {
        this.refresh();

        delete Blockly.Extensions.ALL_[`output_${INTERNAL_SHAPE}`];
        Blockly.CustomShapes.remove(INTERNAL_SHAPE);

        this.shapeInfo.width = Math.max(+this._querys.width.value, 0);
        const factory = execute(this._querys.argument.value, {
          GRID_UNIT: Blockly.BlockSvg.GRID_UNIT,
        });
        factory.closePath(false, true);
        this.shapeInfo.argumentPath = factory.PATH.toString();

        const real_name = JSON.stringify(this._querys.name.value);
        const argument = this._outputs.argument.value = frame(this._querys.argument.value);
        const left = this._outputs.left.value = frame(this._querys.left.value);
        const right = this._outputs.right.value = frame(this._querys.right.value);
        this._outputs.usb.value = `
[${real_name}]: {
  name: ${real_name},
  convertBlockForScratchBlocks(blockJSON) {
    blockJSON.output = ${real_name};
    blockJSON.outputShape = ${real_name};
  },
  argTypeInfo(_context) {
    return {
      type: ${real_name},
      check: ${real_name},
    };
  },
  finalizePlaceholder(_argsName, _blockArgs, argJSON, _argNum, _context) {
    argJSON.check = ${real_name};
  },
  outputExtension(_Blockly, blockSVG) {
    blockSVG.setInputsInline(true);
    blockSVG.setOutputShape(${real_name});
    blockSVG.setOutput(true, ${real_name});
  },
  getInnerPaddingFor(Blockly, shape) {
    switch(shape) {
      [0]: return ${+this._querys.inner.queryItem(0).nextElementSibling.querySelector('input').value} * Blockly.BlockSvg.GRID_UNIT;
      [1]: return ${+this._querys.inner.queryItem(1).nextElementSibling.querySelector('input').value} * Blockly.BlockSvg.GRID_UNIT;
      [2]: return ${+this._querys.inner.queryItem(2).nextElementSibling.querySelector('input').value} * Blockly.BlockSvg.GRID_UNIT;
      [3]: return ${+this._querys.inner.queryItem(3).nextElementSibling.querySelector('input').value} * Blockly.BlockSvg.GRID_UNIT;
      [4]: return ${+this._querys.inner.queryItem(4).nextElementSibling.querySelector('input').value} * Blockly.BlockSvg.GRID_UNIT;
      [${real_name}]: return ${+this._querys.inner.queryItem(SELF_ITEM).nextElementSibling.querySelector('input').value} * Blockly.BlockSvg.GRID_UNIT;
${
  Array.from(this._querys.inner.body.querySelectorAll('tr')).slice(6).map(
    tr => `      [${JSON.stringify(tr.querySelector('input').value)}]: ${tr.querySelector('input[type="number"]').value} * Blockly.BlockSvg.GRID_UNIT;`
  ).join('\n')
}
    }
  },
  getOuterPaddingFor(Blockly, shape) {
    switch(shape) {
      [1]: return ${+this._querys.outer.queryItem(1).nextElementSibling.querySelector('input').value} * Blockly.BlockSvg.GRID_UNIT;
      [2]: return ${+this._querys.outer.queryItem(2).nextElementSibling.querySelector('input').value} * Blockly.BlockSvg.GRID_UNIT;
      [3]: return ${+this._querys.outer.queryItem(3).nextElementSibling.querySelector('input').value} * Blockly.BlockSvg.GRID_UNIT;
      [4]: return ${+this._querys.outer.queryItem(4).nextElementSibling.querySelector('input').value} * Blockly.BlockSvg.GRID_UNIT;
      [${real_name}]: return ${+this._querys.outer.queryItem(SELF_ITEM).nextElementSibling.querySelector('input').value} * Blockly.BlockSvg.GRID_UNIT;
${
  Array.from(this._querys.outer.body.querySelectorAll('tr')).slice(5).map(
    tr => `      [${JSON.stringify(tr.querySelector('input').value)}]: ${tr.querySelector('input[type="number"]').value} * Blockly.BlockSvg.GRID_UNIT;`
  ).join('\n')
}
    }
  },
  getLeftPath(blockSVG, steps) {
    return (function(steps) {
      steps.push(${left});
      return steps;
    }).call(blockSVG, steps);
  },
  getRightPath(blockSVG, steps) {
    return (function(steps) {
      steps.push(${right});
      return steps;
    }).call(blockSVG, steps);
  },
  getArgumentPath(Blockly) {
    return ${argument};
  },
  getWidth(Blockly) {
    return ${Math.max(0, +this._querys.width.value)} * Blockly.BlockSvg.GRID_UNIT;
  },
},
        `.trim();

        this.registerShape();

        this.registerBlocks([
          ...generateBlockCombosJSON(1, 'boolean'),
          ...generateBlockCombosJSON(2, 'round'),
          ...generateBlockCombosJSON(3, 'array'),
          ...generateBlockCombosJSON(4, 'object'),
          ...generateBlockCombosJSON(INTERNAL_SHAPE, INTERNAL_SHAPE),
        ]);

        const INITX = 20, XSCALE = 4, YSCALE = 2.5;
        `
          ${BXML(`internal_stack_${INTERNAL_SHAPE}`, 4 * XSCALE, 4 * YSCALE)}
          ${BXML(`internal_repo_${INTERNAL_SHAPE}_1`, 54 * XSCALE, 4 * YSCALE)}
          ${BXML(`internal_repo_${INTERNAL_SHAPE}_2`, 54 * XSCALE, 29 * YSCALE)}
          ${BXML(`internal_repo_${INTERNAL_SHAPE}_3`, 54 * XSCALE, 54 * YSCALE)}
          ${BXML(`internal_repo_${INTERNAL_SHAPE}_4`, 54 * XSCALE, 79 * YSCALE)}
          ${BXML(`internal_repo_${INTERNAL_SHAPE}_${INTERNAL_SHAPE}`, 54 * XSCALE, 108 * YSCALE)}
          ${BXML(`internal_repo_1_${INTERNAL_SHAPE}`, 4 * XSCALE, 33 * YSCALE)}
          ${BXML(`internal_repo_2_${INTERNAL_SHAPE}`, 4 * XSCALE, 58 * YSCALE)}
          ${BXML(`internal_repo_3_${INTERNAL_SHAPE}`, 4 * XSCALE, 83 * YSCALE)}
          ${BXML(`internal_repo_4_${INTERNAL_SHAPE}`, 4 * XSCALE, 108 * YSCALE)}
        `.trim().split('\n').forEach(block => {
          const dom = Blockly.Xml.textToDom(String(block));
          block = Blockly.Xml.domToBlock(dom, this.ws);
          block.moveBy(+dom.getAttribute('x') + INITX, +dom.getAttribute('y'));
          this.ws.newBlock(block);
        });
      }
    }
    const execute = (js, scope, self, factory) => {
      const global = Object.create(null);
      self = self ?? global;
      factory = factory ?? new Blockly.Shpr.PathBuilder();
      factory.factory = factory.factory ?? factory;
      with (Object.freeze(Object.setPrototypeOf(Object.assign({
        ['this']: self,
        globalThis: global,
        window: global,
        global,
        goog: null,
      }, scope, (factory.SKIP ? {} : factory)), null))) {
        return eval(`(function(){;${js};return(factory);})`).call(self);
      }
    };
    const frame = (js) => {
      js = (Babel.transform(js, {
        plugins: ['shpr'],
      }).code);
      console.debug(js);
      const factory = new Blockly.Shpr.BabelFramework();
      execute(js, {
        factory,
      }, {}, factory);
      return factory.toString();
    };

    function temporaryTransition(node, transition, onend) {
        if (node.$tempTransition) {
          node.removeEventListener('transitionend', node.$tempTransition);
          delete node.$tempTransition;
        }
        node.style.transition = transition;
        node.$tempTransition = function() {
          node.removeEventListener('transitionend', node.$tempTransition);
          delete node.$tempTransition;
          this.style.transition = '';
          (onend || (() => null))();
        };
        node.addEventListener('transitionend', node.$tempTransition);
    }
    function createDropableSection(title, id, nodes) {
      const sect = dom.createDom('div', 'section');
      sect.dataset.title = String(id);
      const toolbar = dom.createDom('div', 'toolbar');
      toolbar.dataset.open = 'false';
      const toolbar_control = dom.createDom('img');
      toolbar_control.src = './rotate-right.svg';
      toolbar.onResize = function() {
        content.style.maxHeight = `${content.scrollHeight}px`;
      };
      Blockly.bindEvent_(toolbar_control, 'click', toolbar_control, () => {
        toolbar.dataset.open = (toolbar.dataset.open !== 'true');
        queueMicrotask(() => {
          content.style.removeProperty('display');
          if (JSON.parse(toolbar.dataset.open)) {
            temporaryTransition(content, 'max-height 430ms ease-in-out');
            toolbar.resizeObserver = new ResizeObserver(toolbar.onResize);
            toolbar.resizeObserver.observe(content);
            toolbar.resizeObserver.observe(content.children[0]);
            toolbar.onResize();
            return;
          }
          if (toolbar.resizeObserver) {
            toolbar.resizeObserver.disconnect();
            toolbar.resizeObserver = null;
          }
          temporaryTransition(content, 'max-height 430ms ease-in-out', () => {
            content.style.display = 'none';
          });
          content.style.maxHeight = '0px';
        });
      });
      dom.appendChild(toolbar, toolbar_control);
      const toolbar_title = dom.createDom('span');
      dom.setTextContent(toolbar_title, title);
      dom.appendChild(toolbar, toolbar_title);
      dom.appendChild(sect, toolbar);
      const content = dom.createDom('div', 'content');
      const contentWrapper = dom.createDom('div', 'content-wrapper');
      dom.appendChild(content, contentWrapper);
      content.style.maxHeight = '0px';
      (nodes || (() => null))(contentWrapper);
      dom.appendChild(sect, content);
      return sect;
    }

    class EditableTable {
      constructor(title, titles, items, template) {
        titles.unshift(' ');
        this.template = template;
        this.node = dom.createDom('table', 'etbl');
        if (title) {
          const ttitle = dom.createDom('caption');
          const span = dom.createDom('span');
          dom.setTextContent(span, title);
          dom.appendChild(ttitle, span);
          dom.appendChild(this.node, ttitle);
        }
        const thead = dom.createDom('thead');
        const trhead = dom.createDom('tr');
        for (let i = 0; i < titles.length; ++i) {
          const th = dom.createDom('th', '', titles[i]);
          th.scope = 'col';
          dom.appendChild(trhead, th);
        }
        dom.appendChild(thead, trhead);
        dom.appendChild(this.node, thead);
        this.body = dom.createDom('tbody');
        for (let i = 0; i < items.length; ++i) {
          this.addItem(items[i]);
        }
        dom.appendChild(this.node, this.body); 
        const tfoot = dom.createDom('tfoot');
        const tr = dom.createDom('tr');
        const addItem = dom.createDom('th');
        addItem.scope = 'row';
        const plus = dom.createDom('img');
        plus.src = './add.svg';
        dom.appendChild(addItem, plus);
        dom.appendChild(tr, addItem);
        Blockly.bindEvent_(plus, 'click', this, this.addTemplate);
        const tfootText = dom.createDom('td');
        const footText = dom.createDom('span');
        dom.setTextContent(footText, 'add item');
        dom.appendChild(tfootText, footText);
        dom.appendChild(tr, tfootText);
        dom.appendChild(tr, dom.createDom('td'));
        dom.appendChild(tfoot, tr);
        dom.appendChild(this.node, tfoot);
      }
      _setupSubitem(sub) {
        sub = Object.assign({}, sub);
        sub.editable = sub.editable ?? true;
        sub.value = sub.value ?? 0;
        sub.real = sub.real ?? sub.value;
        sub.type = sub.type ?? 'text';
        sub.query = this._writeQuery(sub.real);
        return sub;
      }
      _writeQuery(value) {
        return `${typeof value}#${String(value)}`;
      }
      _deleteItem() {
        this.nextElementSibling.remove();
        this.nextElementSibling.remove();
        this.remove();
      }
      queryItem(query) {
        return this.body.querySelector(`tr > td[data-query=${JSON.stringify(this._writeQuery(query))}]`);
      }
      addItem(item) {
        const tr = dom.createDom('tr');
        const th = dom.createDom('th');
        th.scope = 'row';
        const deletable = (typeof item[0] === 'boolean') ? item.shift() : true;
        const trash = dom.createDom('img');
        if (deletable) {
          Blockly.bindEvent_(trash, 'click', th, this._deleteItem);
        } else {
          th.setAttribute('disabled', '');
        }
        trash.src = './trash.svg';
        dom.appendChild(th, trash);
        dom.appendChild(tr, th);
        for (let i = 0; i < item.length; ++i) {
          const td = dom.createDom('td');
          const sub = this._setupSubitem(item[i]);
          let node;
          if (sub.editable) {
            node = dom.createDom('input');
            node.type = sub.type;
            if (sub.type === 'number') {
              if (hasOwn(sub, 'min')) node.min = sub.min;
              if (hasOwn(sub, 'max')) node.max = sub.max;
              node.value = Number(sub.value);
            } else {
              node.value = sub.value;
            }
          } else {
            node = dom.createDom('span', '', sub.value);
          }
          dom.appendChild(td, node);
          td.dataset.query = sub.query;
          dom.appendChild(tr, td);
        }
        dom.appendChild(this.body, tr);
      }
      addTemplate() {
        return this.addItem(structuredClone(this.template));
      }
      static create(title, titles, items, template) {
        return (new EditableTable(title, titles, items, template)).node;
      }
    }

    let blocks;
    const body = dom.createDom('main', 'body');
    (() => {
      const themesDialog = (() => {
        const dialog = dom.createDom('dialog', 'theme-picker');
        dom.appendChild(dialog, dom.createDom('div', 'header theme-picker', 'Theme Selector'));
        const themes = dom.createDom('div', 'themes');
        dom.appendChild(dialog, themes);
        dom.appendChild(document.body, dialog);
        return dialog;
      })();
      const showThemePicker = () => {
        const themesFlex = themesDialog.querySelector('div.themes');
        themesFlex.innerHTML = 'press esc to leave this menu';
        Retheme.forEach(themeName => {
          const theme = dom.createDom('div');
          theme.innerHTML = `
            <svg fill="var(--${themeName})" viewBox="0 0 15 15" version="1.1" xmlns="http://www.w3.org/2000/svg">
              <path d="M14,7.5c0,3.5899-2.9101,6.5-6.5,6.5S1,11.0899,1,7.5S3.9101,1,7.5,1S14,3.9101,14,7.5z"/>
            </svg>
            <span>${themeName}</span>
          `;
          dom.appendChild(themesFlex, theme);
          Blockly.bindEvent_(theme, 'click', Retheme, Retheme.setTheme.bind(Retheme, themeName));
        });
        themesDialog.showModal();
      };
      const header = dom.createDom('div', 'header');
      (() => {
        dom.appendChild(header, dom.createDom('span', '', 'Shpr'));
        const themer = dom.createDom('button');
        Blockly.bindEvent_(themer, 'click', themer, showThemePicker);
        dom.appendChild(header, themer);
        const source = dom.createDom('a', '', 'source code');
        source.href = 'https://github.com/Unsandboxed/shaper/';
        dom.appendChild(header, source);
      })();
      dom.appendChild(body, header);  

      const sub = dom.createDom('div', 'wrapper');
      const _editor = dom.createDom('div', 'editor');
      const editor = dom.createDom('div', 'container');

      let leftSideCode, rightSideCode, argumentCode;
      const DrenderButton = dom.createDom('div');
      const renderButton = dom.createDom('button');
      dom.setTextContent(renderButton, 'Render Shape!');
      dom.appendChild(DrenderButton, renderButton);
      Blockly.bindEvent_(renderButton, 'click', renderButton, () => {
        blocks.refreshShape();
      });
      dom.appendChild(DrenderButton, dom.createDom('span', '', ' Shape Name: '));
      const name = dom.createDom('input');
      name.type = 'text';
      name.value = 'arrow';
      dom.appendChild(DrenderButton, name);
      dom.appendChild(editor, DrenderButton);
      dom.appendChild(editor, createDropableSection('Argument path', 'argumentPathCode', (s) => {
        argumentCode = dom.createDom('textarea', '', `cursor.goto(4 * GRID_UNIT, 0);\ncurves.cubic.relative(\n  -3 * GRID_UNIT,\n  0,\n  -1.75 * GRID_UNIT,\n  3.5 * GRID_UNIT,\n  -4 * GRID_UNIT,\n  4 * GRID_UNIT\n);\ncurves.cubic.relative(\n  2.25 * GRID_UNIT,\n  0.5 * GRID_UNIT,\n  GRID_UNIT,\n  4 * GRID_UNIT,\n  4 * GRID_UNIT,\n  4 * GRID_UNIT\n);\nline.horizontal(4 * GRID_UNIT);\ncurves.cubic.relative(\n  3 * GRID_UNIT,\n  0,\n  1.75 * GRID_UNIT,\n  -3.5 * GRID_UNIT,\n  4 * GRID_UNIT,\n  -4 * GRID_UNIT\n);\ncurves.cubic.relative(\n  -2.25 * GRID_UNIT,\n  -0.5 * GRID_UNIT,\n  0 - GRID_UNIT,\n  -4 * GRID_UNIT,\n  -4 * GRID_UNIT,\n  -4 * GRID_UNIT\n);\nline.horizontal(-4 * GRID_UNIT);`);
        argumentCode.spellcheck = false;
        dom.appendChild(s, argumentCode);
      }));
      dom.appendChild(editor, createDropableSection('Left path', 'leftPathCode', (s) => {
        leftSideCode = dom.createDom('textarea', '', `curves.cubic.relative(\n  0 - 0.5625 * edgeShapeWidth_,\n  0 - 0.125 * edgeShapeWidth_,\n  0 - 0.25 * edgeShapeWidth_,\n  0 - edgeShapeWidth_,\n  0 - edgeShapeWidth_,\n  0 - edgeShapeWidth_\n);\ncurves.cubic.relative(\n  0.75 * edgeShapeWidth_,\n  0,\n  0.4375 * edgeShapeWidth_,\n  0 - 0.875 * edgeShapeWidth_,\n  edgeShapeWidth_,\n  0 - edgeShapeWidth_\n);`);
        leftSideCode.spellcheck = false;
        dom.appendChild(s, leftSideCode);
      }));
      dom.appendChild(editor, createDropableSection('Right path', 'rightPathCode', (s) => {
        rightSideCode = dom.createDom('textarea', '', `curves.cubic.relative(\n  0.5625 * edgeShapeWidth_,\n  0.125 * edgeShapeWidth_,\n  0.25 * edgeShapeWidth_,\n  edgeShapeWidth_,\n  edgeShapeWidth_,\n  edgeShapeWidth_\n);\ncurves.cubic.relative(\n  0 - 0.75 * edgeShapeWidth_,\n  0,\n  0 - 0.4375 * edgeShapeWidth_,\n  0.875 * edgeShapeWidth_,\n  0 - edgeShapeWidth_,\n  edgeShapeWidth_\n);`);
        rightSideCode.spellcheck = false;
        dom.appendChild(s, rightSideCode);
      }));
      let innerPaddingsTable, outerPaddingsTable, outputWidth;
      dom.appendChild(editor, createDropableSection('Sizing', 'sizing', (s) => {
        const DwidthInput = dom.createDom('div');
        dom.appendChild(DwidthInput, dom.createDom('span', '', 'Shape Width: '));
        outputWidth = dom.createDom('input');
        outputWidth.type = 'number';
        outputWidth.min = 0;
        outputWidth.value = 12;
        dom.appendChild(DwidthInput, outputWidth);
        dom.appendChild(DwidthInput, dom.createDom('span', '', ' * GRID_UNIT'));
        dom.appendChild(s, DwidthInput);
        const paddingTemplate = [true, { value: 'n/a', type: 'text' }, { value: '', type: 'number', min: 0 }];
        innerPaddingsTable = new EditableTable('Inner Padding', ['In Shape', 'Padding * GRID_UNIT'], [
          [false, { real: 0, value: 'field', editable: false }, { value: '5', type: 'number' }],
          [false, { real: 1, value: 'hexagonal', editable: false }, { value: '4', type: 'number' }],
          [false, { real: 2, value: 'round', editable: false }, { value: '5', type: 'number' }],
          [false, { real: 3, value: 'square', editable: false }, { value: '5', type: 'number' }],
          [false, { real: 4, value: 'object', editable: false }, { value: '3', type: 'number' }],
          [false, { real: SELF_ITEM, value: 'self', editable: false }, { value: '3', type: 'number' }],
        ], paddingTemplate);
        dom.appendChild(s, innerPaddingsTable.node);
        outerPaddingsTable = new EditableTable('Outer Padding', ['Out Shape', 'Padding * GRID_UNIT'], [
          [false, { real: 1, value: 'hexagonal', editable: false }, { value: '3', type: 'number' }],
          [false, { real: 2, value: 'round', editable: false }, { value: '2', type: 'number' }],
          [false, { real: 3, value: 'square', editable: false }, { value: '2', type: 'number' }],
          [false, { real: 4, value: 'object', editable: false }, { value: '3', type: 'number' }],
          [false, { real: SELF_ITEM, value: 'self', editable: false }, { value: '3', type: 'number' }],
        ], paddingTemplate);
        dom.appendChild(s, outerPaddingsTable.node);
      }));

      dom.appendChild(_editor, editor);
      dom.appendChild(sub, _editor);

      const _output = dom.createDom('div', 'output');
      const output = dom.createDom('div', 'container');
      blocks = new ShapeSpace(dom.createDom('blocks'));
      blocks._querys.inner = innerPaddingsTable;
      blocks._querys.outer = outerPaddingsTable;
      blocks._querys.left = leftSideCode;
      blocks._querys.right = rightSideCode;
      blocks._querys.argument = argumentCode;
      blocks._querys.width = outputWidth;
      blocks._querys.name = name;
      dom.appendChild(output, blocks.node);

      dom.appendChild(output, createDropableSection('USB api', 'argumentPathOutput', (s) => {
        const textarea = dom.createDom('textarea', '', ``);
        textarea.readOnly = true;
        textarea.spellcheck = false;
        dom.appendChild(s, textarea);
        blocks._outputs.usb = textarea;
      }));
      dom.appendChild(output, createDropableSection('Argument path', 'argumentPathOutput', (s) => {
        const textarea = dom.createDom('textarea', '', ``);
        textarea.readOnly = true;
        textarea.spellcheck = false;
        dom.appendChild(s, textarea);
        blocks._outputs.argument = textarea;
      }));
      dom.appendChild(output, createDropableSection('Left path', 'leftPathOutput', (s) => {
        const textarea = dom.createDom('textarea', '', ``);
        textarea.readOnly = true;
        textarea.spellcheck = false;
        dom.appendChild(s, textarea);
        blocks._outputs.left = textarea;
      }));
      dom.appendChild(output, createDropableSection('Right path', 'rightPathOutput', (s) => {
        const textarea = dom.createDom('textarea', '', ``);
        textarea.readOnly = true;
        textarea.spellcheck = false;
        dom.appendChild(s, textarea);
        blocks._outputs.right = textarea;
      }));

      dom.appendChild(_output, output);
      dom.appendChild(sub, _output);

      dom.appendChild(body, sub);
    })();
    dom.appendChild(document.body, body);
    blocks.refresh();
  }
}();