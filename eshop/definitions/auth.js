// A protection for multiple sign-in
var protection = {};

// Simple auth for administration
F.on('controller', function(controller, name) {

	if (!controller.url.startsWith(CONFIG('manager-url'), true))
		return;

	// Check protection
	if (protection[controller.req.ip] > 5) {
		controller.plain('401: Unauthorized (BLOCKED)');
		controller.cancel();
		return;
	}

	var auth = controller.baa();
	var user = F.config.custom.users[auth.user + ':' + auth.password];

	if (user) {
		controller.req.user = user;
		return;
	}

	if (!protection[controller.req.ip])
		protection[controller.req.ip] = 1;
	else
		protection[controller.req.ip]++;

	controller.baa('Content Management System (' + protection[controller.req.ip] + ')');
});

// Clear blocked IP addreses
F.on('service', function(interval) {
	if (interval % 30 === 0)
		protection = {};
});