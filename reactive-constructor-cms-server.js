reactiveConstructorCmsBackupsToKeep = 15;

var getCollectionFromConstructorName = function( constructorName ) {
	var constructorCmsOptions = ReactiveConstructors[ constructorName ].constructorDefaults().cmsOptions;
	if (!constructorCmsOptions || !constructorCmsOptions.collection)
		throw new Meteor.Error('reactive-constructor-cms', 'No collection defined for: ' + passedClass.name );
	return constructorCmsOptions.collection;
};

Meteor.methods({
	'reactive-constructor-cms/save': function( item, constructorName, saveOptions ) {

		if (!this.userId)
			throw new Meteor.Error('reactive-constructor-cms', 'You need to be logged in.' );

		check( constructorName, String );

		saveOptions = saveOptions || {};
			
		// Get the collection to store the doc(s) in
		var collection = getCollectionFromConstructorName( constructorName );

		// Is the user passing a published doc?
		// If so: use the actual edit doc!
		if (item.reactiveConstructorCmsStatus === 'published' || item.reactiveConstructorCmsStatus === 'backup'){
			// Get the actual edit doc
			var editDoc = collection.findOne({ _id: item.mainId, reactiveConstructorCmsStatus: 'edit' });
			if (!editDoc)
				throw new Meteor.Error('reactive-constructor-cms', 'No edit doc found for published: ' + item._id );
			item._id = editDoc._id;
		}

		// Save all succesful "saves" in this object, which will eventually be returned
		var updateResult = {};

		// Get a timestamp of this update
		item.updateTime = new Date();

		// Is it a duplication waiting to happen?
		if (saveOptions.duplicate)
			item._id = Meteor.uuid();

		// Save a backup of the doc
		var backupDoc = _.omit( _.clone( item ), '_id' );
		backupDoc.mainId = item._id;

		backupDoc.reactiveConstructorCmsStatus = 'backup';
		updateResult.backup = collection.insert( backupDoc );

		// Remove all backups after the last 15 ones
		updateResult.backupsRemoved = Meteor.call('reactive-constructor-cms/delete-old-backups', backupDoc.mainId, reactiveConstructorCmsBackupsToKeep, constructorName );

		// Publish the doc if the saveOptions.publish was set to true
		if ( saveOptions.publish ){
			var publishDoc = _.clone( backupDoc );
			publishDoc.reactiveConstructorCmsStatus = 'published';
			updateResult.published = collection.upsert({
				mainId: publishDoc.mainId,
				reactiveConstructorCmsStatus: 'published'
			}, publishDoc );
		}

		item.reactiveConstructorCmsStatus = 'edit';

		updateResult.edit = collection.upsert( item._id, _.omit( item, '_id'));

		return updateResult;

	},
	// Method for removing all backups which are older than the numToKeep (number) latest
	'reactive-constructor-cms/delete-old-backups': function( mainId, numToKeep, constructorName ) {

		if (!this.userId)
			throw new Meteor.Error('reactive-constructor-cms', 'You need to be logged in.' );

		// Get the collection
		var collection = getCollectionFromConstructorName( constructorName );
		// Get the numToKeep latest backup (-1 since we're only removing docs AFTER this one)
		var oldestDoc = collection.findOne({ mainId: mainId, reactiveConstructorCmsStatus: 'backup'}, { sort: { updateTime: -1 }, skip: (numToKeep-1) });
		// If there is not 15, then don't do nothing
		if (!oldestDoc) return 0;
		// Else get all the older docs and remove them!
		return collection.remove({ mainId: mainId, reactiveConstructorCmsStatus: 'backup', updateTime: { $lt: oldestDoc.updateTime } });

	},
	'reactive-constructor-cms/delete': function( id, constructorName ) {

		if (!this.userId)
			throw new Meteor.Error('reactive-constructor-cms', 'You need to be logged in.' );
			
		check( id, String );
		check( constructorName, String );

		var constructorCmsOptions = ReactiveConstructors[ constructorName ].constructorDefaults().cmsOptions;
		if (!constructorCmsOptions || !constructorCmsOptions.collection)
			throw new Meteor.Error('reactive-constructor-cms', 'No collection defined for: ' + passedClass.name );

		return constructorCmsOptions.collection.remove({ $or: [{ mainId: id }, { _id: id }] });

	}
});


Meteor.publish('reactive-constructor-cms-publications', function() {

	// These should only be available to logged in users
	if (!this.userId)
		return this.error( new Meteor.Error('reactive-constructor-cms', 'You need to login to subscribe to reactive-constructor-cms-publications' ) );
	
	// Get all the publications
	return _.chain(ReactiveConstructors)
	.map(function( constructor ){
		if (constructor.constructorDefaults().cmsOptions && constructor.constructorDefaults().cmsOptions.collection)
			return constructor.constructorDefaults().cmsOptions.collection;
	})
	.compact()
	.map(function( collection ){
		return collection.find({ reactiveConstructorCmsStatus: 'edit' });
	}).value();

});