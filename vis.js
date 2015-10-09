(function () {
	'use strict';

	moment().format();
	var vis;

	var Palette = [
		'#2E89F4',
		'#F7A24F',
		'#2FD398',
		'#4ADEE5',
		'#F26B30',
		'#A257F2',
		'#412ECE',
		'#B7B149',
		'#6ACE42',
		'#F25394',
		'#F44747',
		'#517CF4'
	];

	var Data = [
		['vw.csv','Volkswagen Diesel Deception'],
		['germanwings.csv', 'Germanwings Crash'],
		['boston.csv', 'Boston Marathon Bombing']
	];

	function objectSize(obj) {
	  var size = 0, key;
	  for (key in obj) {
	      size++;
	  }
	  return size;
	};

	function isValidDate(d) {
	  if ( Object.prototype.toString.call(d) !== "[object Date]" )
	    return false;
	  return !isNaN(d.getTime());
	}

	Array.prototype.clean = function(deleteValue) {
  for (var i = 0; i < this.length; i++) {
    if (this[i] == deleteValue) {         
      this.splice(i, 1);
      i--;
    }
  }
  return this;
};

	var Vis = function (data, title) {
		this.init(data, title);
	}

	Vis.prototype.init = function (data, title) {
		this.data = data;
		this.title = title;
		this.getDimensions();
		this.dataDomain = this.getDomainForData(data);
		this.canvas = this.createCanvas();
		this.x = this.getScaleX();
		this.y = this.getScaleY();
		this.drawTicks();
		this.drawStoriesChart();
		this.shouldBin = true;
		this.binFidelity = d3.time.day;
		
		this.scaleTo('initial');

		this.listen();
	}

	Vis.prototype.getDimensions = function () {
		this.dimensions = {
			canvasWidth : window.innerWidth * .95,
			canvasOffsetX : (window.innerWidth * .05 / 2),
			canvasHeight : 15 * 25,
			canvasOffsetY : (window.innerHeight * .05 / 2),
			rowHeight : 15
		}

		if (this.canvas) {
			this.canvas.attr('width', this.dimensions.canvasWidth)
			this.canvas.attr('height', this.dimensions.canvasHeight)
		}
	}


	Vis.prototype.drawTicks = function () {
		var date = d3.time.day.floor(new Date(this.dataDomain.min));
		var vis = this;

		this.oneDay = this.x(d3.time.day.offset(date, 1).getTime()) - this.x(date);

		var tickPoints = [];

		while (date.getTime() < this.dataDomain.max) {
			date = d3.time.hour.floor(date);
			tickPoints.push(date.getTime());
			date = d3.time.day.offset(date, 1);
		}

		this.canvas.selectAll('.tick')
			.data(tickPoints)
			.enter()
				.append('line')
				.attr('class', 'tick')
				.attr('x1', function(d) { return vis.x(d) })
				.attr('x2', function(d) { return vis.x(d) })
				.attr('y1', 0)
				.attr('y2', this.dimensions.canvasHeight)
				.attr('stroke', '#F7f7f7')

		this.canvas.append('text')
			.attr('class', 'chart-title')
			.attr('x', this.dimensions.canvasWidth / 2)
			.attr('y', -10)
			.attr('text-anchor', 'middle')
			.text(this.title)

		this.canvas.append('text')
			.attr('class', 'range-label range-label-start')
			.attr('x', 0)
			.attr('y', -10)
			.attr('text-anchor', 'start')
			.text(moment(this.x.invert(0)).format('MMMM Do YYYY'))

		this.canvas.append('text')
			.attr('class', 'range-label range-label-end')
			.attr('x', this.dimensions.canvasWidth)
			.attr('y', -10)
			.attr('text-anchor', 'end')
			.text(moment(this.x.invert(this.dimensions.canvasWidth)).format('MMMM Do YYYY'))
	}

	Vis.prototype.getDomainForData = function (data) {
		return {
			max : d3.max(data, function(d) { return d.endDate.getTime(); }),
			min : d3.min(data, function(d) { return d.date.getTime(); })
		};
	}

	Vis.prototype.getScaleY = function () {
		return d3.scale.linear()
			.domain([0, this.data.length])
			.range([this.dimensions.canvasHeight - 10, 10]);
	}

	// CALCULATING
	Vis.prototype.getScaleX = function () {
		var min = this.data.reduce(function (prev, d) {
			var lowest = d.updates.reduce(function (prev, d) {
				if (d.getTime() < prev) {
					return d.getTime()
				}

				return prev;
			}, Infinity);

			if (lowest < prev) {
				return lowest;
			}

			return prev;
		}, Infinity);

		var max = this.data.reduce(function (prev, d) {
			var highest = d.updates.reduce(function (prev, d) {
				if (d.getTime() > prev) {
					return d.getTime();
				}

				return prev;
			}, 0);

			if (highest > prev) {
				return highest;
			}

			return prev;
		}, 0);

		return d3.scale.linear()
			.domain([min, max])
			.range([0, this.dimensions.canvasWidth]);
	}
	

	Vis.prototype.positionGuide = function (x) {
		this.guide.attr('transform', 'translate(' + x + ', 0)');
		this.guide.selectAll('text').text(moment(this.x.invert(x)).format('MMMM Do YYYY h:mm a'))
	}

	Vis.prototype.listen = function () {
		var vis = this;
		this.canvas.on('mousemove', function () {
			var mouse = d3.mouse(this);
			vis.positionGuide(mouse[0]);

			var e = new CustomEvent('moveTo', { 'detail' : mouse[0] });
			window.dispatchEvent(e);
		});

		var drag = d3.behavior.drag();
		var origin;
		this.canvas.call(drag);

		drag.on('dragstart', function () {
			var mouse = d3.mouse(this);

			origin = mouse[0];

			vis.dragVolume = vis.canvas.append('rect')
				.attr('class', 'dragVolume')
				.attr('x', mouse[0])
				.attr('y', 0)
				.attr('height', vis.dimensions.canvasHeight)
				.attr('width', 0)
				.attr('fill', '#F7EE68')
				.attr('opacity', 0.15)
		});

		drag.on('drag', function () {
			if (vis.dragVolume) {
				var mouse = d3.mouse(this);

				var w;
				var x;
				var location = mouse[0];

				if (location < 0) {
					location = 0;
				} else if (location > vis.dimensions.canvasWidth) {
					location = vis.dimensions.canvasWidth;
				}

				if (mouse[0] < origin) {
					w = origin - location;
					x = location;
				} else {
					w = location - origin;
					x = origin;
				}

				vis.dragVolume
					.attr('width', w)
					.attr('x', x);
			}
		});

		drag.on('dragend', function () {
			if (vis.dragVolume) {

				var w, x, startDate, endDate;

				w = parseInt(vis.dragVolume.attr('width'));
				x = parseInt(vis.dragVolume.attr('x'));

				vis.dragVolume.remove();
				vis.dragVolume = undefined;

				if (w < 2) {
					return;
				}

				startDate = vis.x.invert(x);
				endDate = vis.x.invert(x + w);

				vis.scaleTo(startDate, endDate);
			}
		});

		window.addEventListener('keydown', function(e) {
			if (e.keyCode === 27 && vis.dragVolume) {
				vis.dragVolume.remove();
				vis.dragVolume = undefined;
			}
		});
	}


	Vis.prototype.colorForDesk = function (deskName) {
		if (deskName.length === 0) {
			return Palette[0];
		}

		this.deskColors = this.deskColors || {};

		// If there is a color for this desk, return it
		if (this.deskColors[deskName]) {
			return this.deskColors[deskName];
		}

		// If there isn't, add one, and then recurse
		this.deskColors[deskName] = Palette[objectSize(this.deskColors) % Palette.length];
		return this.colorForDesk(deskName);
	}

	Vis.prototype.colorForRole = function (roleName) {
		if (roleName.length === 0) {
			return Palette[0];
		}

		this.roleColors = this.roleColors || {};
 
		if (this.roleColors[roleName]) {
			return this.roleColors[roleName];
		}

		this.roleColors[roleName] = Palette[objectSize(this.roleColors) % Palette.length];
		return this.colorForRole(roleName);
	}

	Vis.prototype.bin = function (time) {

		if (typeof time !== 'object') {
			time = new Date(time);
		}

		if (this.shouldBin) {
			return this.binFidelity.floor(time).getTime();
		}

		return time;
	}

	Vis.prototype.update = function () {

		var vis = this;
		var date = d3.time.day.floor(new Date(this.dataDomain.min));
		this.oneDay = this.x(d3.time.day.offset(date, 1).getTime()) - this.x(date);

		this.canvas.selectAll('.tick')
			.transition().ease('quad-in-out').duration(200)
			.attr('x1', function(d) { return vis.x(d) })
			.attr('x2', function(d) { return vis.x(d) })

		this.canvas.selectAll('.update')
			// .transition().ease('quad-in-out').duration(150)
			.attr('cx', function (d) { return vis.x(vis.bin(d)) });

		this.canvas.selectAll('.row')
			// .transition().ease('quad-in-out').duration(150)
			.attr('x', function(d) { return vis.x(d3.time.day.floor(d.date).getTime()) })
			.attr('width', this.oneDay)

		this.canvas.selectAll('.lifespan')
			// .transition().ease('quad-in-out').duration(150)
			.attr('x1', function(d) { return vis.x(vis.bin(d.date.getTime())) })
			.attr('x2', function(d) { return vis.x(vis.bin(d.endDate.getTime())) })

		this.canvas.selectAll('.tooltip')
			// .transition().ease('quad-in-out').duration(150)
			.attr('transform', function(d) { return 'translate(' + vis.x(vis.bin(d.date.getTime())) + ', -10)' })

		this.canvas.selectAll('.range-label-start')
			.text(moment(this.x.invert(0)).format('MMMM Do YYYY'))

		this.canvas.selectAll('.range-label-end')
			.text(moment(this.x.invert(this.dimensions.canvasWidth)).format('MMMM Do YYYY'))

	}

	Vis.prototype.scaleTo = function (min, max) {
		if (min === 'fit' && max === undefined) {
			min = this.dataDomain.min;
			max = this.dataDomain.max;
		}

		if (min === 'initial' && max === undefined) {
			min = d3.time.day.floor(new Date(this.dataDomain.min));
			max = d3.time.day.offset(min, 14);
		}

		this.x.domain([min, max]);

		this.update();

	}
	// DRAWLING
	Vis.prototype.createCanvas = function () {
		var wrapper = d3.select('body').append('div');
		var vis = this;
		
		wrapper
			.attr('class', 'chart');

		var buttons = wrapper.append('div')
			.attr('class', 'zoom-controls');
		
		var restore = buttons.append('a')
			.attr('href', '#')
			.attr('class', 'restore-zoom button')
			.text('Restore Initial Zoom')

		restore.on('click', function(e) {
			d3.event.preventDefault();
			vis.scaleTo('initial');
		});

		var fit = buttons.append('a')
			.attr('href', '#')
			.attr('class', 'fit-zoom button')
			.text('Show All Points')

		fit.on('click', function(e) {
			d3.event.preventDefault();
			vis.scaleTo('fit');
		})

		var canvas = wrapper.append('svg');

		canvas
			.attr('class', 'canvas')
			.attr('width', this.dimensions.canvasWidth)
			.attr('height', this.dimensions.canvasHeight);

		return canvas;
	}

	Vis.prototype.drawStoriesChart = function () {

		var vis = this;
		var dayCache = new Date(this.data[0].date.getTime())
		var yi = 0;
		
		this.guide = this.canvas.append('g')
			.attr('class', 'guide')

		this.guide.append('line')
			.attr('x1', 0)
			.attr('x2', 0)
			.attr('y1', 0)
			.attr('y2', this.dimensions.canvasHeight)
			.attr('stroke', '#EBEBEB')
			.attr('stroke-width', 1)

		this.guide.append('text')
			.attr('class', 'guide-label')
			.attr('x', 0)
			.attr('y', this.dimensions.canvasHeight + 20)
			.attr('fill', '#CCC')
			.text(moment(this.x.invert(0)).format('MMMM Do YYYY'))
			.attr('text-anchor', 'middle')

		var story = this.canvas.selectAll('.story')
			.data(this.data)
			.enter().append('g')
				.attr('class', 'story')
				.attr('transform', function (d, i) {
					if (d3.time.day.floor(dayCache).getTime() < d3.time.day.floor(d.date).getTime()) {
						yi = 0;
					}

					dayCache = new Date(d.date.getTime());
					var pos = yi;

					yi++;

					return 'translate(0, ' + (vis.dimensions.canvasHeight - pos * vis.dimensions.rowHeight - vis.dimensions.rowHeight) + ')'; 
				})
				.attr('data-color', function(d, i) { return vis.colorForRole(d.role) })
				.on('click', function(d) { window.open(d.url) })

		var hitTarget = story.append('rect')
			.attr('class', 'row')
			.attr('x', function(d) { return vis.x(d3.time.day.floor(d.date).getTime()) })
			.attr('y', 0)
			.attr('width', this.oneDay)
			.attr('height', this.dimensions.rowHeight)
		
		var lifespan = story.append('line')
			.attr('class', 'lifespan')
			.attr('x1', function(d) { return vis.x(d.date.getTime()) })
			.attr('x2', function(d) { return vis.x(d.endDate.getTime()) })
			.attr('y1', this.dimensions.rowHeight / 2)
			.attr('y2', this.dimensions.rowHeight / 2)
			.attr('stroke', function(d, i) { return this.parentNode.getAttribute('data-color'); })
			.attr('stroke-width', 3)
			.attr('opacity', 0.3)
			
		var update = story.selectAll('circle')
			.data(function(d) { return d.updates })
			.enter().append('circle')
				.attr('class', 'update')
				.attr('r', 3)
				.attr('fill', function(d, i) { return this.parentNode.getAttribute('data-color'); })
				.attr('cx', function(d) { return vis.x(d.getTime()) })
				.attr('cy', this.dimensions.rowHeight / 2)

		var tip = story.append('g')
			.attr('transform', function(d) { return 'translate(' + vis.x(d.date.getTime()) + ', -10)' })
			.attr('class', 'tooltip')

		tip.append('text')
			.text(function (d) { return d.headline });

		var legend = d3.select(this.canvas[0][0].parentNode).insert('div', '.canvas')
			.attr('class', 'legend');

		var legendItem = legend.selectAll('.legend-item')
			.data(Object.keys(this.roleColors).map(function(key) { return [key, vis.roleColors[key] ] }))
			.enter()
				.append('div')
				.attr('class', 'legend-item')

		legendItem.append('div')
			.attr('class', 'legend-key')
			.attr('style', function (d) { return 'background: ' + d[1]; })

		legendItem.append('h6')
			.text(function (d) { return d[0] })
	}

	// repository for data sanitizing functions
	var Sanitizer = {
		// Expects list of times updated
		parseChangeLog : function (changeLog, startDate) {
			var log;

			// Separate and trim
			log = changeLog.split(';');
			log = log.map(function (logItem) {
				var time = new Date(logItem);

				if (time !== undefined && isValidDate(time)) {
					return time;
				}
			});

			log = log.sort(function(a, b) {

				if (a.getTime() < b.getTime()) {
					return -1;
				} else if (a.getTime() > b.getTime()) {
					return 1;
				} else if (a.getTime() === b.getTime()) {
					return 0;
				}

			});
			
			if (log[0] === undefined) {
				log[0] = startDate;
			}

			log.clean();

			return log;
		}
	}

	function drawGraph(data) {
		d3.csv(data[0], function (d, i) {
			if (!d.Date) {
				return;
			}

			var updateLog = Sanitizer.parseChangeLog(d.Updates, new Date(d.Date));

			return {
				updates : updateLog,
				date : updateLog[0],
				endDate : updateLog[updateLog.length - 1],
				headline : d.Headline,
				desk : d.Desk,
				type : d.Type,
				role : d.Role,
				url : d.URL
			}
		}, function (error, rows) {
			rows = rows.sort(function (a, b) {
				if (a.date.getTime() < b.date.getTime()) {
					return -1;
				} else if (a.date.getTime() > b.date.getTime()) {
					return 1;
				} else {
					return 0;
				}
			});

			if (!error) {
				Graphs.push(new Vis(rows, data[1]));
			} else {
				console.log(error);
			}
		});
	}

	var Graphs = [];

	Data.forEach(function (datum) {
		drawGraph(datum);
	});

	window.addEventListener('moveTo', function(e) {

		Graphs.forEach(function(graph) {
			graph.positionGuide(e.detail);
		});

	});

	document.querySelector('.bin-setting').addEventListener('click', function (e) {
		e.preventDefault();

		this.classList.toggle('on');

		Graphs.forEach(function(graph) {
			graph.shouldBin = !graph.shouldBin;
			graph.update();
		})
	})

})();