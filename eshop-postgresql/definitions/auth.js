// A protection for multiple sign-in
var protection = {};

// Simple auth for administration
F.on('controller', function(controller, name) {

	if (controller.name !== 'manager')
		return;

	// Checks protection
	if (protection[controller.req.ip] > 10) {
		controller.throw401();
		controller.cancel();
		return;
	}

	var user = F.config.custom.users[controller.req.cookie('__manager')];
	if (user) {
		controller.req.user = user;
		return;
	}

	if (protection[controller.req.ip])
		protection[controller.req.ip]++;
	else
		protection[controller.req.ip] = 1;

	controller.cancel();
	controller.theme('');
	controller.view('manager-login');
});

// Clears blocked IP addreses
F.on('service', function(interval) {
	if (interval % 30 === 0)
		protection = {};
});