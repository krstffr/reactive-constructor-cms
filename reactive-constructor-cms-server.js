reactiveConstructorCmsBackupsToKeep = 15;

var getCollectionFromConstructorName = function( constructorName ) {
	
	// check( constructorName, String );
	// check( ReactiveConstructors[ constructorName ], Function );
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
					if ( doc[key] && ( doc[key].constructor === Array )){
						return _.map(doc[key], function( nestedValue ) {
							if (nestedValue.type && nestedValue.type === 'reactive-constructor-cms-linked-item')
								return nestedValue;
							return getLinkedFields( nestedValue );
						});
					}

					if (doc[key].type && doc[key].type === 'reactive-constructor-cms-linked-item')
						return doc[key];

					if ( doc[key] && ( doc[key].constructor === Object ))
						return extractFields( doc[key] );

					return false;

				}).flattenDeep().compact().value();

			};

			return extractFields( doc );

		};

		return _.reduce( getLinkedFields( publishedDoc ), function(publishedDocsMemo, field){
			return Meteor.call('reactive-constructor-cms/get-published-doc-and-all-linked-docs', field._id, field.constructorName, publishedDocsMemo );
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

		return {
			removePublished: collection.remove({
				mainId: mainId,
				reactiveConstructorCmsStatus: 'published'
			}),
			updatedEditDoc: collection.update({
				mainId: mainId,
				reactiveConstructorCmsStatus: 'edit'
			}, {
				$set: {
					reactiveConstructorIsPublished: false
				}
			})
		};

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

		// The isPublished flag should be false by deafult, only to be set true if saveOptions.publish
		item.reactiveConstructorIsPublished = false;

		// Publish the doc if the saveOptions.publish was set to true
		if ( saveOptions.publish ){

			// Set a isPublished flag to true (so user can know if the current edit-doc is published)
			item.reactiveConstructorIsPublished = true;

			var publishDoc = _.clone( backupDoc );
			publishDoc.reactiveConstructorCmsStatus = 'published';
			updateResult.published = collection.upsert({
				mainId: publishDoc.mainId,
				reactiveConstructorCmsStatus: 'published'
			}, publishDoc );

		}

		item.reactiveConstructorCmsStatus = 'edit';

		// This extra check (which is super annoying and not the best performance-wise!)
		// is due to some DB's setting the _id to and ObjectId instead of a String. This
		// will break this plugin.
		if (!collection.findOne(item._id))
			updateResult.edit = collection.insert( item );
		else
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

	// Used in the publishFilter, to be able to use the meteor server context inside the method
	var meteorServerContext = this;
	
	// Get all the publications
	return _.chain(ReactiveConstructors)
	.map(function( constructor ){
		if (constructor.constructorDefaults().cmsOptions && constructor.constructorDefaults().cmsOptions.collection)
			return { reactiveConstructor: constructor, collection: constructor.constructorDefaults().cmsOptions.collection };
	})
	.compact()
	.map(function( collectionAndConstructor ){
		var query = { reactiveConstructorCmsStatus: 'edit' };
		var publishFilter = collectionAndConstructor.reactiveConstructor.constructorDefaults().cmsOptions.collectionPublishFilter;
		// If there is a publishFilter, "assign" it to the query!
		if ( publishFilter )
			query = _.assign( query, publishFilter.call( meteorServerContext ) );
		return collectionAndConstructor.collection.find( query );
	}).value();

});


// 
// 
// HELPERS FOR GETTING ALL PUBLISHED DOCS IN A PUBLISH/CURSOR-FORMAT
// REFACTOR ALL OF THIS PLEASE!
// 
// 
var getAllLinkedDocsIds = function( doc, memo ) {

	memo = memo || {};

	// check( doc, Object );
	// check( memo, Object );

	// Is the passed "doc" actually a link itself? Then just add it to the
	// memo and return the memo
	if (doc.type === 'reactive-constructor-cms-linked-item') {
		if (!memo[doc.constructorName])
			memo[doc.constructorName] = [];
		memo[doc.constructorName].push( doc._id );
		return memo;
	}

	// Iterate over allt the fields in the doc
	return _.reduce( doc, function( memo, value ){

		// Is it an array?
		// Recurse on every item in the array
		if ( value && ( value.constructor === Array )){
			return _.reduce( value, function( memo, nestedDoc ){
				return getAllLinkedDocsIds( nestedDoc, memo );
			}, memo );
		}

		// Is it not a linked object? Just return the memo
		if ( ( value.constructor !== Object ) || value.type !== 'reactive-constructor-cms-linked-item')
			return memo;
		
		// Make sure we have a contructor for holding the _id…
		if (!memo[value.constructorName])
			memo[value.constructorName] = [];

		// Add the _id (which is in fact a link to the mainId ) to the holder
		// and return the memo!
		memo[value.constructorName].push( value._id );
		
		return memo;

	}, memo );

};

var getDocAndLinks = function( mainId, constructorName, fetchedDocs ) {

	// Holder for all the fetched documents
	fetchedDocs = fetchedDocs || {};

	// Make sure the holder for all fetched docs has the current
	// constructorName as a field for holding all the instances of that
	// constructor
	if (!fetchedDocs[ constructorName ])
		fetchedDocs[ constructorName ] = [];

	// check( mainId, String );
	// check( constructorName, String );
	// check( fetchedDocs, Object );

	// Get the current doc
	var doc = getCollectionFromConstructorName( constructorName ).findOne({ reactiveConstructorCmsStatus: 'published', mainId: mainId });

	// Get all the ids of all the linked docs
	var linkedIds = getAllLinkedDocsIds( doc );

	// Add this doc _id to the fetchedDocs holder (to make sure we don't try to fetch it again)
	fetchedDocs[ constructorName ].push( mainId );

	// Iterated across all the linked ids and recurse!
	return _.reduce( linkedIds, function( memo, linkedIdInConstructor, constructorName ){
		// Get every linked doc which is found in this constructor
		return _.reduce(linkedIdInConstructor, function( memo, linkedId ){
			// Only get the ones which are not already fetched!
			if ( _.indexOf(fetchedDocs[constructorName], linkedId ) < 0 )
				return getDocAndLinks( linkedId, constructorName, fetchedDocs );
			return fetchedDocs;
		}, fetchedDocs );
	}, fetchedDocs ); 

};

reactiveConstructorCmsGetPublishCursorFromDoc = function( initDocument, constructorName ) {

	// check( initDocument.mainId, String );
	// check( constructorName, String );

	var docAndLinks = getDocAndLinks( initDocument.mainId, constructorName );

	return _.map(docAndLinks, function( value, constructorName ){
		return getCollectionFromConstructorName( constructorName ).find({reactiveConstructorCmsStatus: 'published',mainId: { $in: value }});
	});
};