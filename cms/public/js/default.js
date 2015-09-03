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