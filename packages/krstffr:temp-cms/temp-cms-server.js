Meteor.methods({
	'rc-temp-cms/publish': function( item, type, publishBool ) {
			
		// Get the collection to store the doc(s) in
		var constructorCmsOptions = ReactiveConstructors[ type ].constructorDefaults().cmsOptions;
		if (!constructorCmsOptions || !constructorCmsOptions.collection)
			throw new Meteor.Error('temp-cms-no-collection-defined', 'No collection defined for: ' + passedClass.name );

		// Save all succesful "saves" in this object, which will eventually be returned
		var savedDocs = {};

		// Get a timestamp of this update
		item.updateTime = new Date();

		// Save a backup of the doc
		var backupDoc = _.omit( _.clone( item ), '_id' );
		backupDoc.mainId = item._id;
		// TODO: Use proper name for CMS
		backupDoc.tempCmsStatus = 'backup';
		savedDocs.backup = constructorCmsOptions.collection.insert( backupDoc );

		// Publish the doc if the publishBool was set to true
		if (publishBool){
			var publishDoc = _.clone( backupDoc );
			publishDoc.tempCmsStatus = 'published';
			savedDocs.published = constructorCmsOptions.collection.upsert({
				mainId: publishDoc.mainId,
				tempCmsStatus: 'published'
			}, {
				$set: _.omit( publishDoc, ['mainId', 'tempCmsStatus'])
			});
		}

		item.tempCmsStatus = 'edit';

		savedDocs.edit = constructorCmsOptions.collection.upsert( item._id, { $set: _.omit( item, '_id') });

		return savedDocs;

	}
});