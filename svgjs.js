// var RGBColor = require("rgbcolor");
// var stackblur = require("stackblur");

var SVGjs = require("svgjs");

var orgCtx = null;
var miniDrawCmds = [];

// TODO: Parse commands and check e.g if fill is set once and before any fill is made.

function formatJsonArray(arr, tabStr) {
	var res = '';

	if (arr) {
		if (!tabStr) {
			tabStr = '    ';
		}

		var arrLen = arr.length,
			i = 0,
			char,
			tab = '',
			singleQuoteFound = false,
			doubleQuoteFound = false;

		for (; i < arrLen; i++) {
			char = arr[i];

			if (char === '"' && !singleQuoteFound) {
				res += char;

				if (doubleQuoteFound) {
					doubleQuoteFound = false;
				}
				else {
					doubleQuoteFound = true;
				}
			}
			else if (!singleQuoteFound && !doubleQuoteFound) {
				if (char === '[' || char === '{') {
					res += char + '\n';

					tab += tabStr;

					res += tab;
				}
				else if (char === ',') {
					res += char + '\n' + tab;
				}
				else if (char === ']' || char === '}') {
					tab = tab.substring(0, tab.length - tabStr.length);

					res += '\n' + tab + char;
				}
				else {
					res += char;
				}
			}
			else {
				res += char;
			}
		}
	}

	return res;
}

function checkMiniDrawCmd(cmdArray, index) {
	if (cmdArray.length && index >= 0 && index < cmdArray.length) {
		var cmd = cmdArray[index];

		if ((index === 0 && (
			cmd._t === 'clearrect' ||
			cmd._t === 'clip' ||
			cmd._t === 'restore' ||
			cmd._t === 'closepath' ||
			cmd._t === 'stroke' ||
			cmd._t === 'fill'
		)) ||
			(index === cmdArray.length - 1 && (
				cmd._t === 'beginpath' ||
				cmd._t === 'scale' ||
				cmd._t === 'translate' ||
				cmd._t === 'rotate' ||
				cmd._t === 'save' ||
				cmd._t === 'transform'
			))) {
			return null;
		}
	}

	return true;
}

window.checkMiniDrawCmdArray = function (arr) {
	if (Array.isArray(arr) && arr.length) {
		var correctStart,
			correctEnd,
			arrLen = arr.length;

		while (!correctStart && arrLen !== 0) {
			if (!checkMiniDrawCmd(arr, 0)) {
				arr = arr.slice(1);

				correctStart = false;
			}
			else {
				correctStart = true;
			}
		};

		while (!correctEnd && arrLen !== 0) {
			if (!checkMiniDrawCmd(arr, arrLen - 1)) {
				arr = arr.slice(0, arrLen - 1);

				correctEnd = false;
			}
			else {
				correctEnd = true;
			}
		};

		arrLen = arr.length;

		while (arrLen !== 0) {
			if (arr[0]._t === 'save' && arr[arr.length - 1]._t === 'restore') {
				arr = arr.slice(1, arrLen - 1);
				arrLen = arr.length;
			}
			else {
				break;
			}
		}

		var currCmd,
			nextCmd,
			i = 0,
			newArr = [],
			properties = {},
			scaleX = 1,
			scaleY = 1;

		for (; i < arrLen; i++) {
			currCmd = arr[i];

			if (currCmd) {
				// if (i === 0 && currCmd._t === 'save') {
				// 	continue;
				// }

				if (i + 1 < arrLen) {
					nextCmd = arr[i + 1];

					// console.log('cmds', currCmd, nextCmd, i, arrLen, arr, arr.length);

					if ((currCmd._t === 'save' && nextCmd._t === 'restore') ||
						(currCmd._t === 'beginpath' && nextCmd._t === 'closepath')) {
						i++;
						continue;
					}
					else if ((currCmd._t === 'clip' && nextCmd._t === 'clip') ||
						(currCmd._t === 'fill' && nextCmd._t === 'fill') ||
						(currCmd._t === 'stroke' && nextCmd._t === 'stroke')) {
						newArr.push(currCmd);
						i++;
						continue;
					}
					else if ((currCmd._t === 'transform' && nextCmd._t === 'transform')) {
						continue;
					}
				}

				if (currCmd._t === 'property') {
					if (properties[currCmd.name] === currCmd.value) {
						continue;
					}
					else {
						properties[currCmd.name] = currCmd.value;
					}
				}
				else if (currCmd._t === "scale") {
					if (scaleX === currCmd.x && scaleY === currCmd.y) {
						continue;
					}
					else {
						scaleX = currCmd.x;
						scaleY = currCmd.y;
					}
				}

				newArr.push(currCmd);
			}
		}

		arr = newArr;
	}

	return arr;
};

window.formatJson = function (str) {
	return formatJsonArray(str);
};

window.cleanupDrawCmds = function (elem, cmdArray) {
	// Check array for unnecessary draw commands in the beginning or end of the array.
	cmdArray = window.checkMiniDrawCmdArray(cmdArray);

	let gCommands = JSON.stringify(cmdArray);
	// console.log('hmm', gCommands);
	// let gCommands = JSON.stringify(commands);
	elem.value = formatJsonArray(gCommands);

	return cmdArray;
};

let currentTranslate = {
	tx: 0,
	ty: 0
};

let roundFunc = function (val) {
	// return ~~(val);
	return val;
}

let miniDrawCmdTypeMap = {
	moveTo: function (args) {
		if (args.length === 2) {
			let miniCmd = {
				_t: 'moveto',
				//type: 0,
				x: roundFunc(args[0]),
				y: roundFunc(args[1])
				// x: args[0],
				// y: args[1]
			};

			return miniCmd;
		}
	},
	lineTo: function (args) {
		if (args.length === 2) {
			let miniCmd = {
				_t: 'lineto',
				//type: 1,
				x: roundFunc(args[0]),
				y: roundFunc(args[1])
				// x: args[0],
				// y: args[1]
			};

			return miniCmd;
		}
	},
	bezierCurveTo: function (args) {
		if (args.length === 6) {
			let miniCmd = {
				_t: 'bcurveto',
				//type: 2,
				x: roundFunc(args[4]),
				y: roundFunc(args[5]),
				// x: args[4],
				// y: args[5],
				cpx1: args[0],
				cpy1: args[1],
				cpx2: args[2],
				cpy2: args[3]
			};

			return miniCmd;
		}
	},
	quadraticCurveTo: function (args) {
		if (args.length === 4) {
			let miniCmd = {
				_t: 'qcurveto',
				//type: 3,
				x: roundFunc(args[2]),
				y: roundFunc(args[3]),
				cpx: args[0],
				cpy: args[1]
			};

			return miniCmd;
		}
	},
	arc: function (args) {
		if (args.length >= 5) {
			let miniCmd = {
				_t: 'arc',
				//type: 4,
				x: roundFunc(args[0]),
				y: roundFunc(args[1]),
				radius: args[2],
				sAngle: args[3],
				eAngle: args[4]
			};

			if (args.length === 6) {
				miniCmd.ccw = !!args[5];
			}

			return miniCmd;
		}
	},
	beginPath: function (args) {
		let miniCmd = {
			_t: 'beginpath',
			//type: 5
		};

		return miniCmd;
	},
	closePath: function (args) {
		let miniCmd = {
			_t: 'closepath',
			//type: 6
		};

		return miniCmd;
	},
	scale: function (args) {
		if (args.length === 2) {
			let miniCmd = {
				_t: 'scale',
				//type: 7,
				x: args[0],
				y: args[1]
			};

			return miniCmd;
		}
	},
	translate: function (args) {
		if (args.length === 2) {
			let miniCmd = {
				_t: 'translate',
				//type: 8,
				x: roundFunc(args[0]),
				y: roundFunc(args[1])
			};

			if (miniCmd.x || miniCmd.y) {
				return miniCmd;
			}
		}
	},
	transform: function (args) {
		if (args.length === 6) {
			let miniCmd = {
				_t: 'transform',
				//type: 9,
				hMoving: roundFunc(args[4]),
				hSkewing: args[1],
				hScaling: args[0],
				vMoving: roundFunc(args[5]),
				vSkewing: args[2],
				vScaling: args[3]
			};

			return miniCmd;
		}
	},
	rotate: function (args) {
		if (args.length === 1) {
			let miniCmd = {
				_t: 'rotate',
				//type: 10,
				angle: args[0]
			};

			if (miniCmd.angle) {
				return miniCmd;
			}
		}
	},
	save: function (args) {
		let miniCmd = {
			_t: 'save',
			//type: 11
		};

		return miniCmd;
	},
	restore: function (args) {
		let miniCmd = {
			_t: 'restore',
			//type: 12
		};

		return miniCmd;
	},
	clip: function (args) {
		let miniCmd = {
			_t: 'clip',
			//type: 13,
			// fillRule: null
		};

		if (args.length === 1) {
			miniCmd.fillRule = args[0];
		}

		return miniCmd;
	},
	fill: function (args) {
		let miniCmd = {
			_t: 'fill',
			//type: 14,
			// fillRule: null
		};

		if (args.length === 1) {
			miniCmd.fillRule = args[0];
		}

		return miniCmd;
	},
	stroke: function (args) {
		let miniCmd = {
			_t: 'stroke',
			//type: 15
		};

		return miniCmd;
	},
	arcTo: function (args) {
		if (args.length === 5) {
			let miniCmd = {
				_t: 'arcto',
				//type: 16,
				cpx1: args[0],
				cpy1: args[1],
				cpx2: args[2],
				cpy2: args[3],
				radius: roundFunc(args[4])
			};

			return miniCmd;
		}
	},
	clearRect: function (args) {
		if (args.length === 4) {
			let miniCmd = {
				_t: 'clearrect',
				//type: 17,
				x: roundFunc(args[0]),
				y: roundFunc(args[1]),
				width: roundFunc(args[2]),
				height: roundFunc(args[3])
			};

			return miniCmd;
		}
	},
	fillText: function (args) {
		if (args.length === 3) {
			let miniCmd = {
				_t: 'filltext',
				text: roundFunc(args[0]),
				x: roundFunc(args[1]),
				y: roundFunc(args[2])
			};

			return miniCmd;
		}
		else if (args.length === 4) {
			let miniCmd = {
				_t: 'filltext',
				text: roundFunc(args[0]),
				x: roundFunc(args[1]),
				y: roundFunc(args[2]),
				maxWidth: roundFunc(args[3])
			};

			return miniCmd;
		}
	},
	strokeText: function (args) {
		if (args.length === 3) {
			let miniCmd = {
				_t: 'stroketext',
				text: roundFunc(args[0]),
				x: roundFunc(args[1]),
				y: roundFunc(args[2])
			};

			return miniCmd;
		}
		else if (args.length === 4) {
			let miniCmd = {
				_t: 'stroketext',
				text: roundFunc(args[0]),
				x: roundFunc(args[1]),
				y: roundFunc(args[2]),
				maxWidth: roundFunc(args[3])
			};

			return miniCmd;
		}
	}
};

var handler = {
	get: function (target, name) {
		let obj = orgCtx[name];

		if (typeof obj === "function") {
			const origMethod = obj;

			let proxyFunction = function (...args) {
				let result = origMethod.apply(orgCtx, args);
				//console.warn(name + JSON.stringify(args) + ' -> ' + JSON.stringify(result));

				const miniDrawCmd = (miniDrawCmdTypeMap[name] || function () { })(args);

				if (miniDrawCmd) {
					miniDrawCmds.push(miniDrawCmd);
				}

				return result;
			}
			return proxyFunction;
		} else {
			return obj;
		}
	},
	set: function (obj, name, newval) {
		//commands.push({action: "set", attribute: name, value: newval});
		//console.log("set proxy", JSON.stringify(name) + ' -> ' + JSON.stringify(newval));

		miniDrawCmds.push({
			_t: 'property',
			name: name,
			value: typeof newval === 'string' && newval.length ? newval.trim() : newval
		});

		orgCtx[name] = newval;
	}
};

function proxyCtx(ctx) {
	const proxy = new Proxy({}, handler);
	orgCtx = ctx;
	return proxy;
}

let ctx,
	_classes = {};

(function () {
	this.svgjs = function (target, target2, s, cmdLog, opts) {
		commands = [];
		miniDrawCmds = [];

		if (target == null || s == null) {
			return;
		}

		opts = opts || {};
		// console.log(opts);

		this.opts = opts;
		const originalCtx = target.getContext('2d');

		originalCtx.setTransform(1, 0, 0, 1, 0, 0);
		originalCtx.clearRect(0, 0, target.clientWidth, target.clientHeight);

		originalCtx.save();

		ctx = proxyCtx(originalCtx);

		this._wrapperDiv = document.createElement("div");

		_classes = {};
		
		this._drawSvg = SVG(this._wrapperDiv);

		this._drawSvg.svg(this._cleanSvg(s));

		this._drawSvg = this._drawSvg.toPath(true);

		parseSvgChildren(this._drawSvg);

		if (target2) {
			this.renderMiniDrawCmds(miniDrawCmds, target2.getContext('2d'), opts.x || 0, opts.y || 0, target2.clientWidth, target2.clientHeight);
		}

		if (cmdLog) {
			cleanupDrawCmds(cmdLog, miniDrawCmds);
		}

		originalCtx.restore();

		return miniDrawCmds;
	};

	this._cleanSvg = function (svgStr) {
		if (typeof svgStr === 'string') {
			const cleanDiv = document.createElement("div");

			cleanDiv.innerHTML = svgStr;

			const loop = function (elem) {
				// console.log('elem', elem, elem.tagName, elem.tagName.indexOf(':') > 0);

				if (elem) {
					const indexOf = elem.tagName.indexOf(':');

					if (indexOf > 0) {
						const tagName = elem.tagName.substring(0, elem.tagName.indexOf(':'));

						const newElem = document.createElement(tagName);

						newElem.innerHTML = elem.innerHTML;

						if (elem.hasAttributes()) {
							const attrs = elem.attributes,
								attrsLen = attrs.length;

							for (let i = 0; i < attrsLen; i++) {
								const attr = attrs[i];

								newElem.setAttribute(attr.name, attr.value);
							}
						}

						elem.parentNode.replaceChild(newElem, elem);

						elem = newElem;
					}

					const children = elem.children,
						childrenLen = children.length;

					for (let i = 0; i < childrenLen; i++) {
						const child = children[i];

						loop(child);
					}
				}
			};

			loop(cleanDiv);

			return cleanDiv.innerHTML;
		}

		return svgStr;
	}

	this.renderMiniDrawCmds = function (cmds, ctx, x, y, width, height) {
		console.log('mini draw cmds', cmds);
		var i = 0,
			canvasCmd,
			cmdKind,
			cmdsLen = cmds.length,
			halfWidth = width / 2,
			halfHeight = height / 2;

		ctx.save();

		ctx.setTransform(1, 0, 0, 1, 0, 0);

		ctx.clearRect(0, 0, width, height);

		// ctx.save();

		// ctx.strokeStyle = '#a8a8a8';
		// ctx.beginPath();
		// ctx.moveTo(-halfWidth, 0);
		// ctx.lineTo(halfWidth, 0);
		// ctx.stroke();

		// ctx.beginPath();
		// ctx.moveTo(0, -halfHeight);
		// ctx.lineTo(0, halfHeight);
		// ctx.stroke();

		// ctx.restore();

		ctx.translate(halfWidth + x, halfHeight + y);

		var unrestoredSaveCmds = 0;

		for (; i < cmdsLen; i++) {
			canvasCmd = cmds[i];

			switch (canvasCmd._t) {
				case "moveto":
					ctx.moveTo(~~(canvasCmd.x), ~~(canvasCmd.y));
					// var flooredX = ~~(canvasCmd.x),
					// 	flooredY = ~~(canvasCmd.y);


					// // ctx.moveTo(canvasCmd.x, canvasCmd.y);
					// // ctx.moveTo(flooredX, flooredY);

					// ctx.translate(flooredX - canvasCmd.x, flooredY - canvasCmd.y);

					// ctx.moveTo(canvasCmd.x, canvasCmd.y);

					break;

				case "lineto":
					ctx.lineTo(~~(canvasCmd.x), ~~(canvasCmd.y));
					// ctx.lineTo(canvasCmd.x, canvasCmd.y);

					break;

				case "bcurveto":
					ctx.bezierCurveTo(canvasCmd.cpx1, canvasCmd.cpy1, canvasCmd.cpx2, canvasCmd.cpy2, ~~(canvasCmd.x), ~~(canvasCmd.y));
					// ctx.bezierCurveTo(canvasCmd.cpx1, canvasCmd.cpy1, canvasCmd.cpx2, canvasCmd.cpy2, canvasCmd.x, canvasCmd.y);

					break;

				case "qcurveto":
					ctx.quadraticCurveTo(canvasCmd.cpx, canvasCmd.cpy, ~~(canvasCmd.x), ~~(canvasCmd.y));
					// ctx.quadraticCurveTo(canvasCmd.cpx, canvasCmd.cpy, canvasCmd.x, canvasCmd.y);

					break;

				case "arc":
					ctx.arc(~~(canvasCmd.x), ~~(canvasCmd.y), canvasCmd.radius, canvasCmd.sAngle, canvasCmd.eAngle, canvasCmd.ccw);

					break;

				case "beginpath":
					ctx.beginPath();

					break;

				case "closepath":
					ctx.closePath();

					break;

				case "scale":
					ctx.scale(canvasCmd.x, canvasCmd.y);

					break;

				case "translate":
					ctx.translate(canvasCmd.x, canvasCmd.y);

					break;

				case "transform":
					ctx.transform(canvasCmd.hScaling, canvasCmd.hSkewing, canvasCmd.vSkewing, canvasCmd.vScaling, canvasCmd.hMoving, canvasCmd.vMoving);

					break;

				case "rotate":
					ctx.rotate(canvasCmd.angle);

					break;

				case "save":
					ctx.save();

					unrestoredSaveCmds++;

					break;

				case "restore":
					if (unrestoredSaveCmds > 0) {
						ctx.restore();

						unrestoredSaveCmds--;
					}

					break;

				case "clip":
					ctx.clip(canvasCmd.fillRule || 'nonzero');

					break;

				case "fill":
					ctx.fill(canvasCmd.fillRule || 'nonzero');

					break;

				case "stroke":
					ctx.stroke();

					break;

				case "arcto":
					ctx.arcTo(canvasCmd.cpx1, canvasCmd.cpy1, canvasCmd.cpx2, canvasCmd.cpy2, canvasCmd.radius);

					break;

				case "clearrect":
					ctx.clearRect(~~(canvasCmd.x), ~~(canvasCmd.y), ~~(canvasCmd.width), ~~(canvasCmd.height));

					break;

				case "fillText":
					if (canvasCmd.maxWidth) {
						ctx.fillText(canvasCmd.text, canvasCmd.x, canvasCmd.y, canvasCmd.maxWidth);
					}
					else {
						ctx.fillText(canvasCmd.text, canvasCmd.x, canvasCmd.y);
					}
					break;

				case "strokeText":
					if (canvasCmd.maxWidth) {
						ctx.strokeText(canvasCmd.text, canvasCmd.x, canvasCmd.y, canvasCmd.maxWidth);
					}
					else {
						ctx.strokeText(canvasCmd.text, canvasCmd.x, canvasCmd.y);
					}
					break;

				case "property":
					// console.log('property mini draw cmd found!', canvasCmd);

					if (typeof ctx[canvasCmd.name] !== 'function') {
						// console.log(true);
						ctx[canvasCmd.name] = canvasCmd.value;
					}
					break;

				default:
					break;
			}
		}

		for (i = 0; i < unrestoredSaveCmds; i++) {
			ctx.restore();
		}

		ctx.restore();
	};

	function parseSvgChildren(svgNode, canvasOptions) {
		console.log('parseSvgChildren()', svgNode, svgNode && typeof svgNode.each === 'function');


		// fillStrokeSet = {
		// 	fill: null,
		// 	stroke: null,
		// 	fillRule: null,
		// 	fillOpacity: 1,
		// 	strokeOpacity: 1
		// }





		if (svgNode && typeof svgNode.each === 'function') {
			if (typeof canvasOptions !== 'object' || Array.isArray(canvasOptions)) {
				canvasOptions = {};
			}

			let shouldRestore = false;

			const context = new Proxy({}, {
				get: function (target, name) {
					const prop = ctx[name];

					if (typeof prop === 'function' && name !== 'setLineDash' && name !== 'setTransform' && !shouldRestore) {
						shouldRestore = true;

						ctx.save();
					}

					return prop;
				},
				set: function (obj, name, newval) {
					const val = ctx[name];

					if (val !== newval) {
						ctx[name] = newval;
					}
				}
			});

			svgNode.each(function (i, children) {
				// console.log('child', this, i, this.node);

				shouldRestore = false;

				const styleData = getStyleData(this.type, this.node),
					fillStrokeSet = setAttributes(this.node, context, styleData),
					newCanvasOptions = Object.assign({}, canvasOptions);

				if (typeof fillStrokeSet.fill === 'boolean') {
					newCanvasOptions.fill = fillStrokeSet.fill;
				}

				if (typeof fillStrokeSet.stroke === 'boolean') {
					newCanvasOptions.stroke = fillStrokeSet.stroke;
				}

				if (fillStrokeSet.fillRule) {
					newCanvasOptions.fillRule = fillStrokeSet.fillRule;
				}

				if (!isNaN(fillStrokeSet.fillOpacity)) {
					newCanvasOptions.fillOpacity = fillStrokeSet.fillOpacity;
				}

				if (!isNaN(fillStrokeSet.strokeOpacity)) {
					newCanvasOptions.strokeOpacity = fillStrokeSet.strokeOpacity;
				}

				if (this.type === 'path') {
					svgPathArrayToCanvas(this.array().value, newCanvasOptions, context);
				}
				else {
					if (this.type === 'svg') {
						if (this.node && this.node.attributes) {
							let x, y;

							if (this.node.attributes.hasOwnProperty('x')) {
								x = parseFloat(this.node.attributes["x"].nodeValue);
							}

							if (this.node.attributes.hasOwnProperty('y')) {
								y = parseFloat(this.node.attributes["y"].nodeValue);
							}

							if (!isNaN(x) && !isNaN(y)) {
								context.translate(x, y);
							}
						}
					}

					parseSvgChildren(this, newCanvasOptions);
				}

				if (shouldRestore) {
					ctx.restore();

					shouldRestore = false;
				}
			});

		}
	}

	function getStyleItemData(styleStr) {
		if (styleStr && styleStr.length !== 0) {
			var key,
				values = {},
				numOfBrackets = 0,
				tmpStr = '',
				keyStr;

			for (var i = 0; i < styleStr.length; i++) {
				var chr = styleStr[i];

				if (chr === '{') {
					numOfBrackets++;

					if (numOfBrackets === 1) {
						key = tmpStr;

						tmpStr = '';
						keyStr = null;
					}
				}
				else if (chr === '}') {
					numOfBrackets--;

					if (numOfBrackets === 0 && keyStr) {
						values[keyStr] = tmpStr;

						keyStr = null;
						tmpStr = '';
					}
				}
				else if (chr === ':') {
					if (!keyStr) {
						keyStr = tmpStr;
						tmpStr = '';						
					}
				}
				else if (chr === ';') {
					if (keyStr) {
						values[keyStr] = tmpStr;

						keyStr = null;
						tmpStr = '';
					}
				}
				else {
					tmpStr += chr;
				}
			}

			return {
				key, 
				values
			};
		}
	}

	function getStyleData(type, node) {
		// console.log('getStyleData()', node, type);

		if (node && type === 'style') {
			var innerText = node.innerHTML,
				styleRegex = new RegExp(/\.[\w\d]+?\{.+?\}/im),
				matches = styleRegex.exec(innerText),
				elements = {},
				classes = {};

			if (matches && matches.length) {
				for (var i = 0; i < matches.length; i++) {
					var match = matches[i],
						data = getStyleItemData(match);

					if (data) {
						if (data.key.startsWith('.')) {
							var className = data.key.substring(1),
								values = classes[className];

							if (values) {
								for (var valueKey in data.values) {
									if (data.values.hasOwnProperty(valueKey)) {
										values[valueKey] = data.values[valueKey];
									}
								}
							}
							else {
								values = data.values;
							}

							classes[className] = values;
						}
						else if (data.key.startsWith("#")) {
							console.log('getStyleData() no support for id-based css values!', node);
						}
						else {
							var values = elements[data.key];

							if (values) {
								for (var valueKey in data.values) {
									if (data.values.hasOwnProperty(valueKey)) {
										values[valueKey] = data.values[valueKey];
									}
								}
							}
							else {
								values = data.values;
							}

							elements[data.key] = values;
						}
					}
				}
			}

			console.log('getStyleData() result', innerText, matches, node, elements, classes);
			
			return {
				elements,
				classes
			};
		}
	}

	function svgPathArrayToCanvas(pathArray, canvasOptions, context) {
		// console.log('svgPathArrayToCanvas', pathArray, canvasOptions, ctx.fillStyle);

		orgCtx.scale(1, 1);

		if (Array.isArray(pathArray) && pathArray.length !== 0) {
			//setTransform(fillStrokeInfo.transform);

			let x = 0,
				y = 0,
				i,
				cmdIndex,
				cp2x,
				cp2y,
				cmdParamsLen,
				rx,
				ry,
				lastCmd,
				nextCmd,
				pathClosed = false;

			context.beginPath();

			for (cmdIndex = 0; cmdIndex < pathArray.length; cmdIndex++) {
				const arr = pathArray[cmdIndex],
					arrLen = arr.length;

				if (cmdIndex < pathArray.length - 1) {
					const nextArr = pathArray[cmdIndex + 1];

					if (nextArr && nextArr.length !== 0) {
						nextCmd = nextArr[0];
					}
				}

				if (arrLen !== 0) {
					const cmd = arr[0];

					switch (cmd) {
						case 'z':
						case 'Z':
							context.closePath();
							pathClosed = true;
							break;

						case 'M':
							if (arrLen === 3) {
								x = arr[1];
								y = arr[2];

								if (nextCmd !== "A") {
									context.moveTo(x, y);
								}
							}
							break;

						case 'L':
							cmdParamsLen = 2;

							if (arrLen >= cmdParamsLen + 1) {
								for (i = 1; i < arrLen; i += cmdParamsLen) {
									if (i + cmdParamsLen <= arrLen) {
										x = arr[i];
										y = arr[i + 1];
										context.lineTo(x, y);
									}
								}
							}
							break;

						case 'H':
							cmdParamsLen = 1;

							if (arrLen >= cmdParamsLen + 1) {
								for (i = 1; i < arrLen; i += cmdParamsLen) {
									if (i + cmdParamsLen <= arrLen) {
										x = arr[i];
										context.lineTo(x, y);
									}
								}
							}
							break;

						case 'V':
							cmdParamsLen = 1;

							if (arrLen >= cmdParamsLen + 1) {
								for (i = 1; i < arrLen; i += cmdParamsLen) {
									if (i + cmdParamsLen <= arrLen) {
										y = arr[i];
										context.lineTo(x, y);
									}
								}
							}
							break;

						case 'C':
							cmdParamsLen = 6;

							if (arrLen >= cmdParamsLen + 1) {
								for (i = 1; i < arrLen; i += cmdParamsLen) {
									if (i + cmdParamsLen <= arrLen) {
										x = arr[i + 4];
										y = arr[i + 5];
										cp2x = arr[i + 2];
										cp2y = arr[i + 3];
										context.bezierCurveTo(arr[i], arr[i + 1], cp2x, cp2y, x, y);
									}
								}
							}
							break;

						case 'S':
							cmdParamsLen = 4;

							if (arrLen >= cmdParamsLen + 1) {
								for (i = 1; i < arrLen; i += cmdParamsLen) {
									if (i + cmdParamsLen <= arrLen) {
										if (lastCmd === 'C' || lastCmd === 'S') {
											var deltaX = x - cp2x,
												deltaY = y - cp2y,
												oldX = x,
												oldY = y;

											x = arr[i + 2];
											y = arr[i + 3];

											cp2x = arr[i];
											cp2y = arr[i + 1];

											context.bezierCurveTo(oldX + deltaX, oldY + deltaY, cp2x, cp2y, x, y);
										}
										else {
											context.bezierCurveTo(x, y, arr[i], arr[i + 1], arr[i + 2], arr[i + 3]);

											x = arr[i + 2];
											y = arr[i + 3];
										}
									}
								}
							}
							break;

						case 'Q':
							cmdParamsLen = 4;

							if (arrLen >= cmdParamsLen + 1) {
								for (i = 1; i < arrLen; i += cmdParamsLen) {
									if (i + cmdParamsLen <= arrLen) {
										x = arr[i + 2];
										y = arr[i + 3];

										cp2x = arr[i];
										cp2y = arr[i + 1];

										context.quadraticCurveTo(cp2x, cp2y, x, y);
									}
								}
							}
							break;

						case 'T':
							cmdParamsLen = 2;

							if (arrLen >= cmdParamsLen + 1) {
								for (i = 1; i < arrLen; i += cmdParamsLen) {
									if (i + cmdParamsLen <= arrLen) {
										if (lastCmd === 'Q' || lastCmd === 'T') {
											var deltaX = x - cp2x,
												deltaY = y - cp2y,
												oldX = x,
												oldY = y;

											x = arr[i];
											y = arr[i + 1];

											cp2x = oldX + deltaX;
											cp2y = oldY + deltaY;

											context.quadraticCurveTo(cp2x, cp2y, x, y);
										}
										else {
											context.quadraticCurveTo(x, y, arr[i], arr[i + 1]);

											x = arr[i];
											y = arr[i + 1];
										}
									}
								}
							}
							break;

						case 'A':
							cmdParamsLen = 7;

							if (arrLen >= cmdParamsLen + 1) {
								for (i = 1; i < arrLen; i += cmdParamsLen) {
									if (i + cmdParamsLen <= arrLen) {
										var xAxisRotation = parseFloat(arr[i + 2]) * (Math.PI / 180.0);
										var largeArcFlag = parseFloat(arr[i + 3]);
										var sweepFlag = parseFloat(arr[i + 4]);
										rx = arr[i + 5];
										ry = arr[i + 6];

										var curr = { x: x, y: y };
										// x = arr[0];
										// y = arr[1];
										// var rx = pp.getScalar();
										// var ry = pp.getScalar();
										var cp = {
											x: rx,
											y: ry
										};

										rx = arr[i];
										ry = arr[i + 1];

										// Conversion from endpoint to center parameterization
										// http://www.w3.org/TR/SVG11/implnote.html#ArcImplementationNotes
										// x1', y1'
										var currp = {
											x: Math.cos(xAxisRotation) * (curr.x - cp.x) / 2.0 + Math.sin(xAxisRotation) * (curr.y - cp.y) / 2.0,
											y: -Math.sin(xAxisRotation) * (curr.x - cp.x) / 2.0 + Math.cos(xAxisRotation) * (curr.y - cp.y) / 2.0
										};
										// adjust radii
										var l = Math.pow(currp.x, 2) / Math.pow(rx, 2) + Math.pow(currp.y, 2) / Math.pow(ry, 2);
										if (l > 1) {
											rx *= Math.sqrt(l);
											ry *= Math.sqrt(l);
										}
										// cx', cy'
										var s = (largeArcFlag == sweepFlag ? -1 : 1) * Math.sqrt(
											((Math.pow(rx, 2) * Math.pow(ry, 2)) - (Math.pow(rx, 2) * Math.pow(currp.y, 2)) - (Math.pow(ry, 2) * Math.pow(currp.x, 2))) /
											(Math.pow(rx, 2) * Math.pow(currp.y, 2) + Math.pow(ry, 2) * Math.pow(currp.x, 2))
										);
										if (isNaN(s)) s = 0;
										var cpp = { x: s * rx * currp.y / ry, y: s * -ry * currp.x / rx };
										// cx, cy
										var centp = {
											x: (curr.x + cp.x) / 2.0 + Math.cos(xAxisRotation) * cpp.x - Math.sin(xAxisRotation) * cpp.y,
											y: (curr.y + cp.y) / 2.0 + Math.sin(xAxisRotation) * cpp.x + Math.cos(xAxisRotation) * cpp.y
										};
										// vector magnitude
										var m = function (v) { return Math.sqrt(Math.pow(v[0], 2) + Math.pow(v[1], 2)); }
										// ratio between two vectors
										var r = function (u, v) { return (u[0] * v[0] + u[1] * v[1]) / (m(u) * m(v)) }
										// angle between two vectors
										var a = function (u, v) { return (u[0] * v[1] < u[1] * v[0] ? -1 : 1) * Math.acos(r(u, v)); }
										// initial angle
										var a1 = a([1, 0], [(currp.x - cpp.x) / rx, (currp.y - cpp.y) / ry]);
										// angle delta
										var u = [(currp.x - cpp.x) / rx, (currp.y - cpp.y) / ry];
										var v = [(-currp.x - cpp.x) / rx, (-currp.y - cpp.y) / ry];
										var ad = a(u, v);
										if (r(u, v) <= -1) ad = Math.PI;
										if (r(u, v) >= 1) ad = 0;

										if (sweepFlag == 0 && ad > 0) ad = ad - 2 * Math.PI;
										if (sweepFlag == 1 && ad < 0) ad = ad + 2 * Math.PI;

										// for markers
										var halfWay = {
											x: centp.x + rx * Math.cos((a1 + (a1 + ad)) / 2),
											y: centp.y + ry * Math.sin((a1 + (a1 + ad)) / 2)
										};
										// pp.addMarkerAngle(halfWay, (a1 + (a1 + ad)) / 2 + (sweepFlag == 0 ? -1 : 1) * Math.PI / 2);
										// pp.addMarkerAngle(cp, (a1 + ad) + (sweepFlag == 0 ? -1 : 1) * Math.PI / 2);

										// bb.addPoint(cp.x, cp.y); // TODO: this is too naive, make it better

										if (context != null) {
											var r = rx > ry ? rx : ry;
											var sx = rx > ry ? 1 : rx / ry;
											var sy = rx > ry ? ry / rx : 1;
											var shouldRestore = false;
											var cx = 0;
											var cy = 0;

											if (xAxisRotation !== 0 || sx !== 1 || sy !== 1) {
												context.save();
												context.translate(centp.x, centp.y);
												context.rotate(xAxisRotation);
												context.scale(sx, sy);

												shouldRestore = true;
											}
											else {
												cx = centp.x;
												cy = centp.y;
											}

											context.arc(cx, cy, r, a1, a1 + ad, 1 - sweepFlag);

											if (shouldRestore) {
												context.restore();
											}
											// context.scale(1 / sx, 1 / sy);
											// context.rotate(-xAxisRotation);
											// context.translate(-centp.x, -centp.y);
										}

										x = cp.x;
										y = cp.y;
									}
								}
							}

							break;

						default:
							break;
					}

					lastCmd = cmd;
				}
			}

			shouldRestore = false;

			if (canvasOptions.fill) {
				if (!isNaN(canvasOptions.fillOpacity) && context.globalAlpha !== canvasOptions.fillOpacity) {
					context.save();
					context.globalAlpha = canvasOptions.fillOpacity;

					shouldRestore = true;
				}

				if (canvasOptions.fillRule) {
					context.fill(canvasOptions.fillRule);
				}
				else {
					context.fill();
				}

				if (shouldRestore) {
					context.restore();
				}
			}

			if (canvasOptions.stroke) {
				shouldRestore = false;

				if (!isNaN(canvasOptions.strokeOpacity) && context.globalAlpha !== canvasOptions.strokeOpacity) {
					context.save();
					context.globalAlpha = canvasOptions.strokeOpacity;

					shouldRestore = true;
				}

				context.stroke();

				if (shouldRestore) {
					context.restore();
				}
			}
		}
	}

	function setAttributes(node, context, styleData) {
		let fillStrokeSet = {
			fill: null,
			stroke: null,
			fillRule: null,
			fillOpacity: 1,
			strokeOpacity: 1
		};

		if (styleData) {
			if (styleData.classes) {
				for (let className in styleData.classes) {
					if (styleData.classes.hasOwnProperty(className)) {
						var classItem = styleData.classes[className],
							existingClassItem = _classes[className];

						if (existingClassItem) {
							for (let key in classItem) {
								if (classItem.hasOwnProperty(key)) {
									existingClassItem[key] = classItem[key];
								}
							}

							_classes[className] = existingClassItem;
						}
						else {
							_classes[className] = classItem;
						}
					}
				}
			}
		}

		if (node) {
			let classList = node.classList;

			if (classList && classList.length) {
				for (let i = 0; i < classList.length; i++) {
					let item = classList[i],
						styleClass = _classes[item];

					if (styleClass) {
						for (let key in styleClass) {
							if (styleClass.hasOwnProperty(key)) {
								if (!node.attributes[key]) {
									console.log('set attr', key, styleClass[key]);
									node.setAttribute(key, styleClass[key]);
								}
							}
						}
					}
				}
			}

			if (node.attributes) {
				let fillStyle,
					fillRule,
					strokeStyle,
					strokeWidth,
					strokeDashArrayStr,
					miterLimit,
					lineCap,
					lineJoin,
					fillOpacityStr,
					strokeOpacityStr;

				if (node.attributes['fill']) {
					fillStyle = node.attributes['fill'].nodeValue;
				}

				if (node.attributes['fill-rule']) {
					fillRule = node.attributes['fill-rule'].nodeValue;
				}

				if (node.attributes['stroke']) {
					strokeStyle = node.attributes['stroke'].nodeValue;
				}

				if (node.attributes['stroke-width']) {
					strokeWidth = parseFloat(node.attributes['stroke-width'].nodeValue);
				}

				if (node.attributes['stroke-dasharray']) {
					strokeDashArrayStr = node.attributes['stroke-dasharray'].nodeValue;
				}

				if (node.attributes['stroke-miterlimit']) {
					miterLimit = node.attributes['stroke-miterlimit'].nodeValue;
				}

				if (node.attributes['stroke-linecap']) {
					lineCap = node.attributes['stroke-linecap'].nodeValue;
				}

				if (node.attributes['stroke-linejoin']) {
					lineJoin = node.attributes['stroke-linejoin'].nodeValue;
				}

				if (node.attributes['opacity']) {
					fillOpacityStr = node.attributes['opacity'].nodeValue;
					strokeOpacityStr = fillOpacityStr;
				}

				if (node.attributes['style']) {
					const styleStr = node.attributes['style'].nodeValue;

					if (typeof styleStr === 'string') {
						const styles = {},
							stylePairs = styleStr.split(';');

						for (let i = 0; i < stylePairs.length; i++) {
							const keyValuePair = stylePairs[i];

							if (typeof keyValuePair === 'string') {
								const keyValue = keyValuePair.split(':').map((s => { if (s) { return s.trim(); } return s; }));

								if (keyValue.length === 2) {
									styles[keyValue[0]] = keyValue[1];
								}
							}
						}

						if (!fillStyle && styles.hasOwnProperty("fill")) {
							fillStyle = styles["fill"];
						}

						if (!fillRule && styles.hasOwnProperty("fill-rule")) {
							fillRule = styles["fill-rule"];
						}

						if (!fillOpacityStr && styles.hasOwnProperty("fill-opacity")) {
							fillOpacityStr = styles["fill-opacity"];
						}

						if (!strokeStyle && styles.hasOwnProperty("stroke")) {
							strokeStyle = styles["stroke"];
						}

						if (!miterLimit && styles.hasOwnProperty("stroke-miterlimit")) {
							miterLimit = styles["stroke-miterlimit"];
						}

						if (!lineCap && styles.hasOwnProperty("stroke-linecap")) {
							lineCap = styles["stroke-linecap"];
						}

						if (!lineJoin && styles.hasOwnProperty("stroke-linejoin")) {
							lineJoin = styles["stroke-linejoin"];
						}

						if (!strokeOpacityStr && styles.hasOwnProperty("stroke-opacity")) {
							strokeOpacityStr = styles["stroke-opacity"];
						}

						if (isNaN(strokeWidth) && styles.hasOwnProperty("stroke-width")) {
							strokeWidth = parseFloat(styles["stroke-width"]);
						}

						if (!strokeDashArrayStr && styles.hasOwnProperty("stroke-dasharray")) {
							strokeDashArrayStr = styles['stroke-dasharray'].nodeValue;
						}
					}
				}

				if (typeof fillRule === 'string') {
					fillRule = fillRule.toLowerCase();

					if (fillRule !== "nonzero") {
						fillStrokeSet.fillRule = fillRule;
					}
				}

				if (fillStyle) {
					if (fillStyle !== "none") {
						if (fillStyle !== "currentColor") {
							context.fillStyle = fillStyle;
						}

						fillStrokeSet.fill = true;
					}
					else {
						fillStrokeSet.fill = false;
					}
				}

				if (strokeStyle) {
					if (strokeStyle !== "none") {
						if (strokeStyle !== "currentColor") {
							context.strokeStyle = strokeStyle;
						}

						fillStrokeSet.stroke = true;
					}
					else {
						fillStrokeSet.stroke = false;
					}
				}

				if (typeof miterLimit === 'string') {
					context.miterLimit = miterLimit.toLowerCase();
				}

				if (typeof lineCap === 'string') {
					context.lineCap = lineCap.toLowerCase();
				}

				if (typeof lineJoin === 'string') {
					context.lineJoin = lineJoin.toLowerCase();
				}

				if (typeof fillOpacityStr === 'string') {
					const opacity = parseFloat(fillOpacityStr);

					if (!isNaN(opacity)) {
						fillStrokeSet.fillOpacity = opacity;
					}
				}

				if (typeof strokeOpacityStr === 'string') {
					const opacity = parseFloat(strokeOpacityStr);

					if (!isNaN(opacity)) {
						fillStrokeSet.strokeOpacity = opacity;
					}
				}

				if (typeof strokeDashArrayStr === 'string' && strokeDashArrayStr !== 'none') {
					const dashArray = strokeDashArrayStr.split(',').map(s => {
						if (typeof s === 'string') {
							return parseFloat(s.trim());
						}

						return s;
					})
						.filter(s => !isNaN(s));

					if (dashArray.length !== 0 && dashArray % 2 === 0) {
						context.setLineDash(dashArray);
					}
				}

				if (!isNaN(strokeWidth)) {
					context.lineWidth = strokeWidth;

					if (strokeWidth === 0) {
						fillStrokeSet.stroke = false;
					}
				}

				if (node.attributes['transform']) {
					setTransform(node.attributes['transform'].nodeValue, context);
				}
				else if (node.tagName && node.tagName.toLowerCase() === "svg") {
					if (node.attributes["viewBox"]) {
						var vbString = node.attributes["viewBox"].nodeValue,
							vbX, vbY, vbWidth, vbHeight;

						if (vbString) {
							var paramStrings = vbString.split(' '),
								numberArr = [];

							for (var i = 0; i < paramStrings.length; i++) {
								var number = parseInt(paramStrings[i]);

								if (isNaN(number)) {
									number = 0;
								}

								numberArr.push(number);
							}

							if (numberArr.length === 4) {
								vbX = -numberArr[0],
								vbY = -numberArr[1],
								vbWidth = numberArr[2];
								vbHeight = numberArr[3];
							}
						}

						if (vbWidth && vbHeight) {
							var scaleX = 1,
								scaleY = 1;

							if (node.attributes["width"]) {
								var width = parseInt(node.attributes["width"].nodeValue);

								if (!isNaN(width)) {
									scaleX = width / vbWidth;
								}
							}

							if (node.attributes["height"]) {
								var height = parseInt(node.attributes["height"].nodeValue);

								if (!isNaN(height)) {
									scaleY = height / vbHeight;
								}
							}

							if (scaleX !== 1 || scaleY !== 1) {
								context.scale(scaleX, scaleY);
							}
						}

						if (vbX && vbY) {
							context.translate(vbX, vbY);
						}
					}
				}
			}
		}

		return fillStrokeSet;
	}

	function setTransform(transformStr, context) {
		if (transformStr) {
			if (transformStr.startsWith('translate(')) {
				let coordStr = transformStr.substring(10);

				if (coordStr.endsWith(')')) {
					coordStr = coordStr.substring(0, coordStr.length - 1);
				}

				let coords = coordStr.split(',');

				if (coords.length === 1) {
					coords = coordStr.split(' ');
				}

				// console.log('transform translate', coords, parseFloat(coords[0]), parseFloat(coords[1]));
				if (coords.length === 2) {
					context.translate(parseFloat(coords[0]), parseFloat(coords[1]));
				}
			}
			else if (transformStr.startsWith('scale(')) {
				let coordStr = transformStr.substring(6);

				if (coordStr.endsWith(')')) {
					coordStr = coordStr.substring(0, coordStr.length - 1);
				}

				let coords = coordStr.split(',');

				if (coords.length === 1) {
					coords = coordStr.split(' ');
				}

				if (coords.length === 2) {
					context.scale(parseFloat(coords[0]), parseFloat(coords[1]));
				}
			}
			else if (transformStr.startsWith('matrix(')) {
				// console.log('parsa mig!', transformStr);

				let matrixStr = transformStr.substring(7);

				if (matrixStr.endsWith(')')) {
					matrixStr = matrixStr.substring(0, matrixStr.length - 1);
				}

				const valuesArray = matrixStr.split(',').map(s => parseFloat(s.trim())).filter(s => !isNaN(s));

				if (valuesArray.length === 6) {
					context.transform(valuesArray[0], valuesArray[1], valuesArray[2], valuesArray[3], valuesArray[4], valuesArray[5]);
				}
			}
		}
	}

	// function getFillStrokeAttributes(firstNode) {
	// 	var attrs = {
	// 		strokeStyle: null,
	// 		fillStyle: null,
	// 	};

	// 	var loop = function (node) {
	// 		if (node) {
	// 			if (node.attributes) {
	// 				if (node.attributes['fill']) {
	// 					attrs.fillStyle = node.attributes['fill'].nodeValue;
	// 				}

	// 				if (node.attributes['stroke']) {
	// 					attrs.strokeStyle = node.attributes['stroke'].nodeValue;
	// 				}

	// 				if (node.attributes['transform']) {
	// 					attrs.transform = node.attributes['transform'].nodeValue;
	// 				}
	// 			}

	// 			if (!attrs.strokeStyle || !attrs.fillStyle) {
	// 				//loop(node.parentNode);
	// 			}
	// 		}
	// 	};

	// 	loop(firstNode);

	// 	return attrs;
	// }
})();

// svg.topath.js 0.4 - Copyright (c) 2014 Wout Fierens - Licensed under the MIT license
; (function () {

	SVG.extend(SVG.Shape, {
		// Convert element to path
		toPath: function (replace) {
			var w, h, rx, ry, d, path
				, trans = this.transform()
				, box = this.bbox()
				, x = 0
				, y = 0
				, pointArray

			switch (this.type) {
				case 'rect':
					w = this.attr('width')
					h = this.attr('height')
					rx = this.attr('rx')
					ry = this.attr('ry')

					// normalise radius values, just like the original does it (or should do)
					if (rx < 0) rx = 0
					if (ry < 0) ry = 0
					rx = rx || ry
					ry = ry || rx
					if (rx > w / 2) rx = w / 2
					if (ry > h / 2) ry = h / 2

					if (rx && ry) {
						// if there are round corners
						d = [
							'M' + rx + ' ' + y
							, 'H' + (w - rx)
							, 'A' + rx + ' ' + ry + ' 0 0 1 ' + w + ' ' + ry
							, 'V' + (h - ry)
							, 'A' + rx + ' ' + ry + ' 0 0 1 ' + (w - rx) + ' ' + h
							, 'H' + rx
							, 'A' + rx + ' ' + ry + ' 0 0 1 ' + x + ' ' + (h - ry)
							, 'V' + ry
							, 'A' + rx + ' ' + ry + ' 0 0 1 ' + rx + ' ' + y
							, 'z'
						]
					} else {
						// no round corners, no need to draw arcs
						d = [
							'M' + x + ' ' + y
							, 'H' + w
							, 'V' + h
							, 'H' + x
							, 'V' + y
							, 'z'
						]
					}

					x = this.attr('x')
					y = this.attr('y')

					break
				case 'circle':
				case 'ellipse':
					rx = this.type == 'ellipse' ? this.attr('rx') : this.attr('r')
					ry = this.type == 'ellipse' ? this.attr('ry') : this.attr('r')

					d = [
						'M' + rx + ' ' + y
						, 'A' + rx + ' ' + ry + ' 0 0 1 ' + (rx * 2) + ' ' + ry
						, 'A' + rx + ' ' + ry + ' 0 0 1 ' + rx + ' ' + (ry * 2)
						, 'A' + rx + ' ' + ry + ' 0 0 1 ' + x + ' ' + ry
						, 'A' + rx + ' ' + ry + ' 0 0 1 ' + rx + ' ' + y
						, 'z'
					]

					x = this.attr('cx') - rx
					y = this.attr('cy') - ry
					break
				case 'polygon':
				case 'polyline':
					this.move(0, 0)

					pointArray = this.array().value

					d = []

					for (var i = 0, len = pointArray.length; i < len; i++)
						d.push((i == 0 ? 'M' : 'L') + pointArray[i][0] + ' ' + pointArray[i][1])

					if (this.type == 'polygon')
						d.push('Z')

					this.move(box.x, box.y)

					x = box.x
					y = box.y
					break
				case 'line':
					this.move(0, 0)

					d = [
						'M' + this.attr('x1') + ' ' + this.attr('y1')
						, 'L' + this.attr('x2') + ' ' + this.attr('y2')
					]

					this.move(box.x, box.y)

					x = box.x
					y = box.y
					break
				case 'path':
					path = this.clone()
					path.unbiased = true
					path.plot(this.attr('d'))

					x = box.x
					y = box.y
					break
				default:
					console.log('SVG toPath got unsupported type ' + this.type, this)
					break
			}

			if (Array.isArray(d)) {
				// create path element
				path = this.parent()
					.path(d.join(''), true)
					.move(x + trans.x, y + trans.y)
					.attr(normaliseAttributes(this.attr()))

				// insert interpreted path after original
				this.after(path)
			}

			if (this instanceof SVG.Shape && path) {
				// store original details in data attributes
				path
					.data('topath-type', this.type)
					.data('topath-id', this.attr('id'))

				// remove original if required
				if (replace === true)
					this.remove()
				else
					path.original = this
			}

			var classList = this.node.classList;

			if (classList.length) {
				for (var i = 0; i < classList.length; i++) {
					var item = classList[i];

					path.node.classList.add(item);
				}
			}

			return path
		}

	})

	SVG.extend(SVG.Parent, {
		// Recruisive path conversion
		toPath: function (replace) {
			// cloning children array so that we don't touch the paths we create
			var children = [].slice.call(this.children())

			// convert top paths
			for (var i = children.length - 1; i >= 0; i--)
				if (typeof children[i].toPath === 'function')
					children[i].toPath(replace)

			return this
		}
	})

	// Normalise attributes
	function normaliseAttributes(attr) {
		for (var a in attr)
			if (!/fill|stroke|opacity|style/.test(a))
				delete attr[a]

		return attr
	}

}).call(this);

module.exports = {
	svgjs,
	renderCommands: renderMiniDrawCmds
};