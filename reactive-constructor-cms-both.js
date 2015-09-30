if (!ReactiveConstructorCmsPlugin)
  ReactiveConstructorCmsPlugin = {};

// Method for getting the Mongo Collection from a constructor name
ReactiveConstructorCmsPlugin.getCollectionFromConstructorName = function( constructorName ) {

	if (!ReactiveConstructors[ constructorName ])
		throw new Meteor.Error('reactive-constructor-cms', '!ReactiveConstructors[ '+constructorName+' ]' );

	if (!ReactiveConstructors[ constructorName ].constructorDefaults)
		return false;

	// Get the defaults defined by the user
	var defaults = ReactiveConstructors[ constructorName ].constructorDefaults();

	// Get the collection to store the doc(s) in
	if (!defaults.cmsOptions || !defaults.cmsOptions.collection)
		return false;

	var collection = defaults.cmsOptions.collection;

	// Make sure we have a collection
	check( collection, Meteor.Collection );

	return collection;

};
