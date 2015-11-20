Array.prototype.sqlagent = function(onItem, callback) {

	var self = this;
	var item = self.shift();

	if (item === undefined) {
		if (callback)
			callback();
		return self;
	}

	onItem.call(self, item, function(val) {

		if (val === false) {
			self.length = 0;
			if (callback)
				callback();
			return;
		}

		setImmediate(function() {
			self.sqlagent(onItem, callback);
		});
	});

	return self;
};