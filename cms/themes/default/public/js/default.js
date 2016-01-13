// Online visitors counter
PING('GET /api/ping/');

COMPONENT('emaildecode', function() {
	var self = this;
	self.readonly();
	self.make = function() {
		var m = self.element.html().replace(/\(\w+\)/g, function(value) {
			switch (value) {
				case '(at)':
					return '@';
				case '(dot)':
					return '.';
			}
			return value;
		});
		self.element.html('<a href="mailto:' + m + '">' + m + '</a>');
	};
});

COMPONENT('gallery', function() {

	var self = this;
	var layer;
	var visible = false;

	self.index = 0;
	self.max = 0;
	self.readonly();

	// For all galleries
	if (!window.$gallery_init) {
		$(document.body).append('<div id="gallery-layer"><a herf="javascript:void(0)" class="gallery-close"><span class="fa fa-times"></span></a><div class="gallery-container"><div class="gallery-prev"><span class="fa fa-arrow-left"></span></div><div class="gallery-image"><img src="/img/empty.png" /><div class="gallery-alt"></div></div><div class="gallery-next"><span class="fa fa-arrow-right"></span></div></div></div>');
		window.$gallery_init = true;

		$(window).on('keydown', function(e) {
			if (!window.$gallery)
				return;
			if (e.keyCode === 39)
				window.$gallery.next();
			else if (e.keyCode === 37)
				window.$gallery.prev();
			else if (e.keyCode === 27)
				window.$gallery.hide();
		});

		$(document).on('click', '.gallery-prev,.gallery-next,.gallery-close', function() {
			var el = $(this);

			if (el.hasClass('gallery-close')) {
				window.$gallery.hide();
				return;
			}

			if (el.hasClass('gallery-prev')) {
				window.$gallery.prev();
				return;
			}

			window.$gallery.next();
		});

		$(window).on('resize', function() {
			FIND('gallery', true).forEach(function(component) {
				component.show(true);
			});
		});
	}

	self.next = function() {
		self.go(self.index + 1);
	};

	self.prev = function() {
		self.go(self.index - 1);
	};

	self.hide = function() {
		visible = false;
		layer.hide();
		window.$gallery = null;
	};

	self.go = function(index) {
		if (index >= self.max)
			self.index = 0;
		else if (index < 0)
			self.index = self.max - 1;
		else
			self.index = index;
		self.show();
	};

	self.refresh = function() {
		self.max = 0;
		self.find('.gallery').each(function(index) {
			var item = $(this);
			var image = item.find('img');
			item.append('<div class="gallery-info"><div>' + image.attr('alt') + '</div><span class="fa fa-camera"></span><b>' + image.attr('data-width') + 'x' + image.attr('data-height') + '</b></div>');
			item.attr('data-index', index);
			self.max++;
		});
	};

	self.make = function() {
		layer = $('#gallery-layer');
		self.refresh();
		self.element.on('click', '.gallery', function() {
			var item = $(this);
			self.index = parseInt(item.attr('data-index'));
			self.show();
		});
	};

	self.show = function(isResize) {

		if (isResize) {
			if (!visible)
				return;
		}

		var img = self.find('.gallery[data-index="' + self.index + '"]').find('img');
		var big = layer.find('img');

		big.attr('src', img.attr('data-original'));

		var mw = img.attr('data-width').parseInt();
		var mh = img.attr('data-height').parseInt();
		var $w = $(window);
		var ww = (($w.width() / 100) * 70) >> 0;
		var wh = (($w.height() / 100) * 90) >> 0;
		var alt = img.attr('alt');
		var w = 0;
		var h = 0;
		var ratio = mw > mh ? mw / mh : mh / mw;

		if (mw > mh) {
			w = mw;
			h = w / ratio;
		} else {
			h = mh;
			w = h / ratio;
		}

		if (w > ww) {
			w = ww - 20;
			h = w / (mw / mh);
		} else if (h > wh) {
			h = wh - 20;
			w = h / (mh / mw);
		}

		big.attr({ width: w >> 0, height: h >> 0 });
		layer.find('.gallery-alt').html(alt).toggleClass('hidden', alt ? false : true);

		if (visible)
			return;

		layer.show();
		visible = true;
		window.$gallery = self;
	};
});

COMPONENT('newsletter', function() {
	var self = this;
	var button;
	var input;

	self.readonly();
	self.make = function() {

		button = self.find('button');
		input = self.find('input');

		self.element.on('keydown', 'input', function(e) {
			if (e.keyCode !== 13)
				return;
			button.trigger('click');
		});

		button.on('click', function() {

			var mail = input.val();
			if (!mail.match(/^[a-z0-9A-Z_\.]+@[0-9a-zA-Z_]+?\.[a-zA-Z]{2,3}$/))
				return;

			$.components.POST('/api/newsletter/', { email: input.val() }, function(response) {

				if (response.success) {
					input.addClass('newsletter-success');
					input.val(self.attr('data-success'));
				}

				setTimeout(function() {
					input.val('');
					input.removeClass('newsletter-success');
				}, 3000);
			});
		});
	};
});