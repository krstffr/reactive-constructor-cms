Package.describe({
	name: "krstffr:temp-cms",
	summary: "CMS for krstffr:reactive-constructor instances.",
	version: "0.0.1"
});

Package.onUse(function (api) {

	api.versionsFrom("METEOR@0.9.0");

	api.use([
		"templating",
		"reactive-var@1.0.4",
		"krstffr:reactive-constructor@0.0.7",
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

	api.export([
		"tempCMSInstances",
		"TEMPcmsPlugin"
		], "client");

});

Package.onTest(function (api) {
  	
  api.use(["tinytest", "krstffr:reactive-constructor", "krstffr:temp-cms"], ["client", "server"]);

  api.export("ReactiveConstructors", ["server", "client"]);

  api.addFiles("tests/tempCMStests.js", ["client", "server"]);

});