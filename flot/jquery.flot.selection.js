/* Flot plugin for selecting regions of a plot.

Copyright (c) 2007-2014 IOLA and Ole Laursen.
Licensed under the MIT license.

The plugin supports these options:

selection: {
	mode: null or "x" or "y" or "xy",
	color: color,
	shape: "round" or "miter" or "bevel",
	minSize: number of pixels
}

Selection support is enabled by setting the mode to one of "x", "y" or "xy".
In "x" mode, the user can only select horizontally. In "y" mode, only
vertically. In "xy" mode, the selection becomes a rectangle.

"color" is the color of the selection rectangle. "shape" is the shape of the
corners of the selection rectangle. "minSize" is the minimum size a selection
can be in pixels.

When a selection is made, a "plotselected" event is fired on the placeholder
div, with a parameter object with the ranges of the axes. A selection can be
cleared by calling plot.clearSelection(). The "plotunselected" event is fired
when the selection is cleared.

The plugin also adds the following methods to the plot object:

- setSelection( ranges, preventEvent )

  Set the selection rectangle. The ranges is an object with the ranges of the
  axes, like this:

  {
  	xaxis: { from: 0, to: 10 },
  	yaxis: { from: 40, to: 60 }
  }

  If the axis is an x-axis, the range is in terms of "x" values, otherwise "y"
  values. If preventEvent is true, the "plotselected" event won't be fired.

- clearSelection( preventEvent )

  Clear the selection rectangle. If preventEvent is true, the "plotunselected"
  event won't be fired.

- getSelection()

  Returns the current selection in the same format as the range object passed
  to setSelection(). If there's currently no selection, it returns null.

*/

(function ($) {
	function init(plot) {
		var selection = {
			first: { x: -1, y: -1}, second: { x: -1, y: -1},
			show: false,
			active: false
		};

		// FIXME: The drag handling implemented here should be moved to a
		// separate plugin for general drag handling and used by the selection
		// plugin. This would allow drag handling to be used by other plugins
		// without incurring a re-implementation of the same code.

		var savedhandlers = {};

		var mouseUpHandler = null;

		function onMouseDown(e) {
			if (e.which != 1)  // only accept left-mouse-button
				return;

			// cancel out any text selections
			document.body.focus();

			// prevent text selection and drag in old-school browsers
			if (document.onselectstart !== undefined && savedhandlers.onselectstart == null) {
				savedhandlers.onselectstart = document.onselectstart;
				document.onselectstart = function () { return false; };
			}
			if (document.ondrag !== undefined && savedhandlers.ondrag == null) {
				savedhandlers.ondrag = document.ondrag;
				document.ondrag = function () { return false; };
			}

			setSelectionPos(selection.first, e);

			selection.active = true;

			// this is a bit silly, but we have to use a closure to be
			// able to whack the same handler again
			mouseUpHandler = function (e) {
				onMouseUp(e);
			};

			$(document).one("mouseup", mouseUpHandler);
		}

		function onMouseUp(e) {
			mouseUpHandler = null;

			// revert drag stuff for old-school browsers
			if (document.onselectstart !== undefined)
				document.onselectstart = savedhandlers.onselectstart;
			if (document.ondrag !== undefined)
				document.ondrag = savedhandlers.ondrag;

			// no more dragging
			selection.active = false;
			updateSelection(e);

			if (selectionIsSane()) {
				triggerSelectedEvent();
			}
			else {
				// this counts as a clear
				plot.getPlaceholder().trigger("plotunselected", [ ]);
				plot.getPlaceholder().trigger("plotselecting", [ null ]);
			}

			return false;
		}

		function onMouseMove(e) {
			if (selection.active) {
				updateSelection(e);

				if (selectionIsSane())
					triggerSelectingEvent();
			}
		}

		function onKeyDown(e) {
			if (e.keyCode == 27) { // esc
				if (mouseUpHandler) {
					$(document).off("mouseup", mouseUpHandler);
					mouseUpHandler(e);
				}
				plot.clearSelection();
			}
		}

		function triggerSelectedEvent() {
			var ranges = getSelection();

			plot.getPlaceholder().trigger("plotselected", [ ranges ]);

			// backwards-compat stuff, to be removed in future
			if (ranges.xaxis && ranges.yaxis) {
				plot.getPlaceholder().trigger("selected", [ { x1: ranges.xaxis.from, y1: ranges.yaxis.from, x2: ranges.xaxis.to, y2: ranges.yaxis.to } ]);
			}
		}

		function triggerSelectingEvent() {
			var ranges = getSelection();
			plot.getPlaceholder().trigger("plotselecting", [ ranges ]);
		}

		function getSelection() {
			if (!selectionIsSane())
				return null;

			var r = {}, c1 = selection.first, c2 = selection.second;
			$.each(plot.getAxes(), function (name, axis) {
				if (axis.used) {
					var p1 = axis.c2p(c1[axis.direction]), p2 = axis.c2p(c2[axis.direction]);
					r[name] = { from: Math.min(p1, p2), to: Math.max(p1, p2) };
				}
			});
			return r;
		}

		function selectionIsSane() {
			var minSize = plot.getOptions().selection.minSize;
			return Math.abs(selection.second.x - selection.first.x) >= minSize &&
				Math.abs(selection.second.y - selection.first.y) >= minSize;
		}

		function setSelectionPos(pos, e) {
			var o = plot.getPlaceholder().offset();
			var plotOffset = plot.getPlotOffset();
			pos.x = Math.max(0, Math.min(e.pageX - o.left - plotOffset.left, plot.width()));
			pos.y = Math.max(0, Math.min(e.pageY - o.top - plotOffset.top, plot.height()));
		}

		function updateSelection(e) {
			if (e.pageX == null)
				return;

			setSelectionPos(selection.second, e);
			if (selectionIsSane()) {
				selection.show = true;
				plot.triggerRedrawOverlay();
			}
			else
				clearSelection(true);
		}

		function clearSelection(preventEvent) {
			if (selection.show) {
				selection.show = false;
				plot.triggerRedrawOverlay();
				if (!preventEvent)
					plot.getPlaceholder().trigger("plotunselected", [ ]);
			}
		}

		// function taken from markings support in Flot
		function extractRange(ranges, coord) {
			var axis, from, to, key, axes = plot.getAxes();

			for (var i = 0; i < axes.length; ++i) {
				axis = axes[i];
				if (axis.direction == coord) {
					key = coord + axis.n + "axis";
					if (!ranges[key] && axis.n == 1)
						key = coord + "axis"; // support x1axis as xaxis
					if (ranges[key]) {
						from = ranges[key].from;
						to = ranges[key].to;
						break;
					}
				}
			}

			// backwards-compat stuff - to be removed in future
			if (!ranges[key]) {
				axis = coord == "x" ? plot.getXAxes()[0] : plot.getYAxes()[0];
				from = ranges[coord + "1"];
				to = ranges[coord + "2"];
			}

			// auto-reverse as an added bonus
			if (from != null && to != null && from > to) {
				var tmp = from;
				from = to;
				to = tmp;
			}

			return { from: from, to: to, axis: axis };
		}

		function setSelection(ranges, preventEvent) {
			var axis, range,
				options = plot.getOptions();

			if (options.selection.mode == "xy") {
				var x = extractRange(ranges, "x");
				var y = extractRange(ranges, "y");

				selection.first.x = x.axis.p2c(x.from);
				selection.second.x = x.axis.p2c(x.to);
				selection.first.y = y.axis.p2c(y.from);
				selection.second.y = y.axis.p2c(y.to);
			} else if (options.selection.mode == "x") {
				var x = extractRange(ranges, "x");

				selection.first.x = x.axis.p2c(x.from);
				selection.second.x = x.axis.p2c(x.to);

				selection.first.y = 0;
				selection.second.y = plot.height();
			} else { // y
				var y = extractRange(ranges, "y");

				selection.first.y = y.axis.p2c(y.from);
				selection.second.y = y.axis.p2c(y.to);

				selection.first.x = 0;
				selection.second.x = plot.width();
			}

			selection.active = false;
			updateSelection({}); // update and redraw

			if (!preventEvent && selectionIsSane())
				triggerSelectedEvent();
		}

		plot.clearSelection = clearSelection;
		plot.setSelection = setSelection;
		plot.getSelection = getSelection;

		plot.hooks.bindEvents.push(function(plot, eventHolder) {
			var options = plot.getOptions();
			if (options.selection.mode != null) {
				eventHolder.on("mousedown", onMouseDown);
				eventHolder.on("keydown", onKeyDown);
			}
		});

		plot.hooks.drawOverlay.push(function (plot, ctx) {
			// draw selection
			if (selection.show && selectionIsSane()) {
				var plotOffset = plot.getPlotOffset();
				var o = plot.getOptions();

				ctx.save();
				ctx.translate(plotOffset.left, plotOffset.top);

				var c = $.color.parse(o.selection.color);

				ctx.strokeStyle = c.scale('a', 0.8).toString();
				ctx.lineWidth = 1;
				ctx.lineJoin = o.selection.shape;
				ctx.fillStyle = c.scale('a', 0.4).toString();

				var x = Math.min(selection.first.x, selection.second.x) + 0.5,
					y = Math.min(selection.first.y, selection.second.y) + 0.5,
					w = Math.abs(selection.second.x - selection.first.x) - 1,
					h = Math.abs(selection.second.y - selection.first.y) - 1;

				ctx.fillRect(x, y, w, h);
				ctx.strokeRect(x, y, w, h);

				ctx.restore();
			}
		});

		plot.hooks.shutdown.push(function (plot, eventHolder) {
			eventHolder.off("mousedown", onMouseDown);
			eventHolder.off("keydown", onKeyDown);
			if (mouseUpHandler)
				$(document).off("mouseup", mouseUpHandler);
		});

		plot.hooks.processOptions.push(function(plot, options) {
			if (options.selection.mode) {
				// We need to listen to mousemove events for selection to work,
				// which is not the default behavior for Flot.
				options.grid.hoverable = true;

				// We also need to disable the built-in crosshair plugin,
				// otherwise it will be activated by the hover events.
				if (options.crosshair && options.crosshair.mode) {
					options.crosshair.mode = null;
				}
			}
		});
	}

	$.plot.plugins.push({
		init: init,
		options: {
			selection: {
				mode: null, // one of null, "x", "y" or "xy"
				color: "#e8cfac",
				shape: "round", // one of "round", "miter", or "bevel"
				minSize: 5 // minimum number of pixels
			}
		},
		name: 'selection',
		version: '1.1'
	});
})(jQuery);