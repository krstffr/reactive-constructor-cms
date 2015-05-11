Package.describe({
	name: "krstffr:reactive-constructor-cms",
	summary: "CMS for krstffr:reactive-constructor instances.",
	version: "0.2.0-alpha"
});

Package.onUse(function (api) {

	api.versionsFrom("METEOR@0.9.0");

	api.use([
		"templating",
		"reactive-var@1.0.4",
		"krstffr:reactive-constructor@1.1.0-alpha",
		"mizzao:jquery-ui@1.11.2",
    "stevezhu:lodash@1.0.2"
		], "client");

	api.addFiles([
		"reactive-constructor-cms.js",
		"reactive-constructor-cms-templates.html",
		"reactive-constructor-cms-templates.js",
		"styles.css",
		], "client");

	api.addFiles([
		"reactive-constructor-cms-server.js"
		], "server");

	api.export([
		"tempCMSInstances",
		"ReactiveConstructorCmsPlugin"
		], "client");

	api.export([
		// "ReactiveConstructors"
		], ["client", "server"]);

});

Package.onTest(function (api) {
  	
  api.use([
  	"tinytest",
  	"krstffr:reactive-constructor",
  	"krstffr:reactive-constructor-cms",
  	"accounts-base",
  	"accounts-password"
  	], ["client", "server"]);

  api.export(["ReactiveConstructors", "Persons"], ["server", "client"]);

  api.addFiles([
  	"tests/ReactiveConstructorCmsTests.js"
  	], ["client", "server"]);

});