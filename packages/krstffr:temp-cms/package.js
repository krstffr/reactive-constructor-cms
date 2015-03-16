Package.describe({
	name: "krstffr:temp-cms",
	summary: "CMS for krstffr:reactive-constructor instances.",
	version: "0.0.1"
});

Package.onUse(function (api) {

	api.versionsFrom("METEOR@0.9.0");

	api.use([
		"templating",
		"krstffr:reactive-constructor@0.0.4"
		], "client");

	api.addFiles([
		"temp-cms.js",
		"temp-cms-templates.html",
		"temp-cms-templates.js"
		], "client");

});