Package.describe({
	name: "krstffr:temp-cms",
	summary: "CMS for krstffr:reactive-constructor instances.",
	version: "0.0.1"
});

Package.onUse(function (api) {

	api.versionsFrom("METEOR@0.9.0");

	api.use([
		"templating",
		"krstffr:reactive-constructor@0.0.4",
		"mizzao:jquery-ui@1.11.2",
    "stevezhu:lodash@1.0.2"
		], "client");

	api.addFiles([
		"temp-cms.js",
		"temp-cms-templates.html",
		"temp-cms-templates.js"
		], "client");

	api.addFiles([
		"temp-cms-server.js"
		], "server");

});