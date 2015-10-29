Package.describe({
	name: "krstffr:reactive-constructor-cms",
	summary: "CMS for krstffr:reactive-constructor instances.",
	version: "0.5.2"
});

Package.onUse(function (api) {

	api.versionsFrom("METEOR@0.9.0");

	api.use([
		"templating",
		"reactive-var@1.0.5",
		"krstffr:reactive-constructor@1.2.5",
		"krstffr:msgs@0.0.8",
		"mizzao:jquery-ui@1.11.4"
		], "client");

	api.use([
		"ecmascript@0.1.5",
		"stevezhu:lodash@3.10.1",
		"check@1.0.5"
		], ["client", "server"]);

	api.addFiles([
		"reactive-constructor-cms.js",
		"reactive-constructor-cms-templates.html",
		"reactive-constructor-cms-templates.js",
		"reactive-constructor-cms-edit-value-overlay.js",
		"styles.css",
		], "client");

	api.addFiles([
		"reactive-constructor-cms-both.js",
	], ["client", "server"]);

	api.addFiles([
		"reactive-constructor-cms-server.js"
		], "server");

	api.export([
		"ReactiveConstructorCmsPlugin"
		], "client");

	api.export([
		"reactiveConstructorCmsGetPublishCursorFromDoc"
		], "server");

});

Package.onTest(function (api) {

  api.use([
  	"check",
  	"tinytest",
  	"krstffr:reactive-constructor",
  	"krstffr:reactive-constructor-cms",
  	"accounts-base",
  	"krstffr:msgs",
  	"accounts-password",
  	"stevezhu:lodash@3.10.1"
  	], ["client", "server"]);

  api.export(["ReactiveConstructors", "Persons", "Animals"], ["server", "client"]);

  api.addFiles([
  	"tests/ReactiveConstructorCmsTests.js"
  	], ["client", "server"]);

});
