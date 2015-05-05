tempCmsBackupsToKeep = 15;

var getCollectionFromConstructorName = function( constructorName ) {
	var constructorCmsOptions = ReactiveConstructors[ constructorName ].constructorDefaults().cmsOptions;
	if (!constructorCmsOptions || !constructorCmsOptions.collection)
		throw new Meteor.Error('temp-cms-no-collection-defined', 'No collection defined for: ' + passedClass.name );
	return constructorCmsOptions.collection;
};

Meteor.methods({
	'rc-temp-cms/save': function( item, constructorName, saveOptions ) {

		saveOptions = saveOptions || {};
			
		// Get the collection to store the doc(s) in
		var collection = getCollectionFromConstructorName( constructorName );

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
		// TODO: Use proper name for CMS
		backupDoc.tempCmsStatus = 'backup';
		updateResult.backup = collection.insert( backupDoc );

		// Remove all backups after the last 15 ones
		updateResult.backupsRemoved = Meteor.call('rc-temp-cms/delete-old-backups', backupDoc.mainId, tempCmsBackupsToKeep, constructorName );

		// Publish the doc if the saveOptions.publish was set to true
		if ( saveOptions.publish ){
			var publishDoc = _.clone( backupDoc );
			publishDoc.tempCmsStatus = 'published';
			updateResult.published = collection.upsert({
				mainId: publishDoc.mainId,
				tempCmsStatus: 'published'
			}, publishDoc );
		}

		item.tempCmsStatus = 'edit';

		updateResult.edit = collection.upsert( item._id, _.omit( item, '_id'));

		return updateResult;

	},
	// Method for removing all backups which are older than the numToKeep (number) latest
	'rc-temp-cms/delete-old-backups': function( mainId, numToKeep, constructorName ) {
		// Get the collection
		var collection = getCollectionFromConstructorName( constructorName );
		// Get the numToKeep latest backup (-1 since we're only removing docs AFTER this one)
		var oldestDoc = collection.findOne({ mainId: mainId, tempCmsStatus: 'backup'}, { sort: { updateTime: -1 }, skip: (numToKeep-1) });
		// If there is not 15, then don't do nothing
		if (!oldestDoc) return 0;
		// Else get all the older docs and remove them!
		return collection.remove({ mainId: mainId, tempCmsStatus: 'backup', updateTime: { $lt: oldestDoc.updateTime } });

	},
	'rc-temp-cms/delete': function( id, constructorName ) {
			
		check( id, String );
		check( constructorName, String );

		var constructorCmsOptions = ReactiveConstructors[ constructorName ].constructorDefaults().cmsOptions;
		if (!constructorCmsOptions || !constructorCmsOptions.collection)
			throw new Meteor.Error('temp-cms-no-collection-defined', 'No collection defined for: ' + passedClass.name );

		return constructorCmsOptions.collection.remove({ $or: [{ mainId: id }, { _id: id }] });

	}
});


Meteor.publish('temp-cms-publications', function() {
	
	// Get all the publications
	return _.chain(ReactiveConstructors)
	.map(function( constructor ){
		if (constructor.constructorDefaults().cmsOptions && constructor.constructorDefaults().cmsOptions.collection)
			return constructor.constructorDefaults().cmsOptions.collection;
	})
	.compact()
	.map(function( collection ){
		return collection.find({ tempCmsStatus: 'edit' });
	}).value();

});