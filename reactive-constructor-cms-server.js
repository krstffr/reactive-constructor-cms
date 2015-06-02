reactiveConstructorCmsBackupsToKeep = 15;

var getCollectionFromConstructorName = function( constructorName ) {
	
	check( constructorName, String );
	check( ReactiveConstructors[ constructorName ], Function );

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

Meteor.methods({
	// TODO: This needs to fetch ALL linked docs from a collection at the same time (not one doc at a time!) instead.
	// Method for getting a published doc AND all the docs which are linked to that object.
	'reactive-constructor-cms/get-published-doc-and-all-linked-docs': function( mainId, constructorName, publishedDocs ) {

		// Make sure user has passed the correct input types
		check( mainId, String );
		check( constructorName, String );
		
		if (!publishedDocs)
			publishedDocs = {};
		check( publishedDocs, Object );

		// Make sure we have an array @ publishedDocs[constructorName]
		// for storing all the docs to return.
		if (!publishedDocs[constructorName])
			publishedDocs[constructorName] = [];

		// Is the document already in the publishedDocs[constructorName]?
		// Just return the passed published docs!
		if ( _.findWhere(publishedDocs[constructorName], { mainId: mainId }) )
			return publishedDocs;

		// Get the published docuemnt. If there is none: just return the
		// published docs.
		var publishedDoc = Meteor.call('reactive-constructor-cms/get-published-doc', mainId, constructorName );
		if (!publishedDoc)
			return publishedDocs;

		// Add the published doc to the array.
		publishedDocs[constructorName].push( publishedDoc );

		// Method for extracting all the linked fields from the docment.
		var getLinkedFields = function( doc ) {

			var extractFields = function( doc ) {

				return  _( _.keys( doc ) ).map(function( key ) {

					// Is it an array?
					if (Match.test( doc[key], Array )){
						return _.map(doc[key], function( nestedValue ) {
							if (nestedValue.type && nestedValue.type === 'reactive-constructor-cms-linked-item')
								return nestedValue;
							return getLinkedFields( nestedValue );
						});
					}

					if (doc[key].type && doc[key].type === 'reactive-constructor-cms-linked-item')
						return doc[key];

					if (Match.test( doc[key], Object ))
						return extractFields( doc[key] );

					return false;

				}).flatten().compact().value();

			};

			return extractFields( doc );

		};

		return _.reduce( getLinkedFields( publishedDoc ), function(publishedDocsMemo, field){
			publishedDocsMemo = Meteor.call('reactive-constructor-cms/get-published-doc-and-all-linked-docs', field._id, field.constructorName, publishedDocsMemo );
			return publishedDocsMemo;
		}, publishedDocs);

	},
	// Method for getting a backup version of an instance
	'reactive-constructor-cms/get-backup-doc': function( mainId, constructorName, updateTime, version ) {

		check( constructorName, String );
		check( mainId, String );
		check( updateTime, Date );
		check( version, Number );

		var collection = getCollectionFromConstructorName( constructorName );

		// Return the "version" latest version of the backups which are older
		// than the passed updateTime
		return collection.findOne({
			mainId: mainId,
			reactiveConstructorCmsStatus: 'backup',
			updateTime: {
				$lt: updateTime
			}
		}, {
			sort: { updateTime: -1 },
			skip: version
		});

	},
	'reactive-constructor-cms/get-published-doc': function( mainId, constructorName ) {

		check( mainId, String );
		check( constructorName, String );

		var collection = getCollectionFromConstructorName( constructorName );

		return collection.findOne({ mainId: mainId, reactiveConstructorCmsStatus: 'published' });

	},
	'reactive-constructor-cms/unpublish': function( mainId, constructorName ) {

		if (!this.userId)
			throw new Meteor.Error('reactive-constructor-cms', 'You need to be logged in.' );

		check( mainId, String );
		check( constructorName, String );

		var collection = getCollectionFromConstructorName( constructorName );

		return collection.remove({ mainId: mainId, reactiveConstructorCmsStatus: 'published' });

	},
	'reactive-constructor-cms/save': function( item, constructorName, saveOptions ) {

		if (!this.userId)
			throw new Meteor.Error('reactive-constructor-cms', 'You need to be logged in.' );

		check( constructorName, String );
			
		// Get the collection to store the doc(s) in
		var collection = getCollectionFromConstructorName( constructorName );

		saveOptions = saveOptions || {};

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

		item.mainId = item._id;

		// Save a backup of the doc
		var backupDoc = _.omit( _.clone( item ), '_id' );

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

		var collection = getCollectionFromConstructorName( constructorName );

		return collection.remove({ $or: [{ mainId: id }, { _id: id }] });

	}
});


Meteor.publish('reactive-constructor-cms__editable-docs', function() {

	// These should only be available to logged in users
	if (!this.userId)
		return this.error( new Meteor.Error('reactive-constructor-cms', 'You need to login to subscribe to reactive-constructor-cms__editable-docs' ) );
	
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