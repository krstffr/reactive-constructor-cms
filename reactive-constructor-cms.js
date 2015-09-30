// Use this for MongoDB dates
var ISODate = Date;

// This is the view for the CMS
renderedCMSView = false;

// This is the var which will hold the select overview template
renderedCMSSelectOverview = false;

var reactiveConstructorCmsExtraInstanceFields = {
	_id: String,
	reactiveConstructorCmsName: String,
	reactiveConstructorCmsStatus: String,
	reactiveConstructorIsPublished: Boolean,
	updateTime: ISODate,
	mainId: String
};

ReactiveConstructorCmsPlugin = new ReactiveConstructorPlugin({

	initConstructor: function ( passedClass ) {

		// console.log('ReactiveConstructorCmsPlugin: initConstructor() ', passedClass.constructorName );

		// Method for returning the type of an item as a string.
		var getTypeOfStructureItem = function ( item ) {

			// Is is a reactive constructor?
			// Return the constructor name!
			if (item.constructorName)
				return item.constructorName;

			// Does the item actaully have a name?
			// Then it's probably a String or a Number or a Boolean, return it
			if (item.name)
				return item.name;

			// Is it an array?
			if ( item && ( item.constructor ===  Array ) ) {

				// Does it have any items?
				if (item.length < 1)
					return 'Array';

				return 'Collection_'+item[0].constructorName;

			}

		};

		// Method for returing an "overriding" inputtype, for example a textarea
		// instead of a text.
		// TODO: Needs to check "global" overrides as well!
		// Has test: ✔
		passedClass.prototype.getInputType = function( key ) {
			var cmsOptions = this.getAllCmsOptions();
			if (cmsOptions.inputs && cmsOptions.inputs[key])
				return cmsOptions.inputs[key].type;
			return false;
		};

		// If a collection is defined for this constructor, make sure this
		// instance has an _id field
		passedClass.prototype.setupCmsFields = function() {

			if (this.getCollection()) {

				if ( !this.getReactiveValue('_id') ){
					var _id = Meteor.uuid();
					this.setReactiveValue('_id', _id );
					this.setReactiveValue('mainId', _id );
				}

				if ( !this.getReactiveValue('reactiveConstructorCmsName') )
					this.setReactiveValue('reactiveConstructorCmsName', 'New ' + this.getType() );

				this._id = this.getReactiveValue('_id');
				this.reactiveConstructorCmsName = this.getReactiveValue('reactiveConstructorCmsName');

				// Also make sure it has a reactiveConstructorIsPublished field

			}

			return true;

		};

		// Method for returning the data for the CMS frontend basically
		// Will not return the fields in reactiveConstructorCmsExtraInstanceFields
		// EXCEPT the reactiveConstructorCmsName
		// Has test: ✔
		passedClass.prototype.getReactiveValuesAsArray = function () {
			var instance = this;
			var typeStructure = _.assign( instance.getCurrentTypeStructure(), reactiveConstructorCmsExtraInstanceFields );
			return _(instance.reactiveData.get())
			.map(function( value, key ) {
				// Only return the non CMS fields (EXCEPT reactiveConstructorCmsName!)
				if ( reactiveConstructorCmsExtraInstanceFields[key] === undefined ||
					( instance.getReactiveValue('_id') &&
						key === 'reactiveConstructorCmsName' )) {
					return {
						key: key,
						value: instance.getReactiveValue(key),
						type: getTypeOfStructureItem( typeStructure[key] ),
						fieldCmsOptions: instance.getCmsOption('inputs')[key]
					};
				}
			})
			.compact()
			.value();
		};

		// Method for removing item from an array
		// (an array in the reactive object, found from the passed key)
		// Has test: ✔
		passedClass.prototype.arrayitemRemove = function ( listKey, indexToRemove ) {
			// Get the array…
			var arr = this.getReactiveValue( listKey );
			if (arr && arr.constructor !== Array)
				throw new Meteor.Error('reactive-constructor-cms', arr + ' is not an array. (arrayitemRemove)' );
			// …remove the item…
			arr.splice( indexToRemove, 1 );
			// …and update the array.
			return this.setReactiveValue( listKey, arr );
		};

		// Method for moving an item in an array
		// (an array in the reactive object, found from the passed key)
		// Has test: ✔
		passedClass.prototype.arrayitemMove = function ( listKey, newIndex, oldIndex ) {

			// If new and old index are the same, just return true
			if (newIndex === oldIndex)
				return true;

			var instance = this;

			// Get the array…
			var arr = instance.getReactiveValue( listKey );
			if (arr && arr.constructor !== Array)
				throw new Meteor.Error('reactive-constructor-cms', arr + ' is not an array. (arrayitemMove)' );

			// Is the move within the size of the array?
			// If not: return true!
			if (newIndex < 0 || newIndex > (arr.length-1))
				return true;

			// …move the item…
			arr.splice( newIndex, 0, arr.splice( oldIndex, 1 )[0] );

			// …and update the array.
			// This extra "reset" to an empty array is because the DOM would not
			// update correctly sometimes with complex nested instances.
			// instance.setReactiveValue( listKey, [] );
			// return _.defer(function(){
				return instance.setReactiveValue( listKey, arr );
			// });
		};

		// Method for duplicating an item in an array,
		// putting it next to the item we duplicate
		// (an array in the reactive object, found from the passed key)
		// Has test: ✔
		passedClass.prototype.arrayitemDuplicate = function ( listKey, indexToDuplicate ) {
			// Get the array…
			var arr = this.getReactiveValue( listKey );
			if (arr && arr.constructor !== Array)
				throw new Meteor.Error('reactive-constructor-cms', arr + ' is not an array. (arrayitemDuplicate)' );

			// Get the item we want to duplicate
			var item = arr[indexToDuplicate];
			// Is it an "ordinary" new instance? Or a link to an exisiting DB doc
			if ( item.getType && ( item.getType.constructor === Function) ) {
				// Use the .getDataAsObject() method to get this items data, and also add this instances type
				var newItemData = _.assign({ rcType: item.getType() }, item.getDataAsObject() );
				// Is the item creatable? Assign a new _id
				if ( item.getCollection() )
					newItemData._id = Meteor.uuid();
				// Use the items .constructor to create a new instance and push this to the array
				arr.push( new item.constructor( newItemData ) );
			}
			else{
				// It's a link to an existing object!
				// Just clone it.
				arr.push( _.clone( item ) );
			}
			// Update the array…
			this.setReactiveValue( listKey, arr );
			// …and move the item to the position after the one being copied
			return this.arrayitemMove( listKey, (indexToDuplicate+1), (this.getReactiveValue( listKey ).length - 1) );
		};

		// Method for getting the value of passed key for this instances cmsOptions
		// Has test:
		passedClass.prototype.getCmsOption = function( key ) {
			// check( key, String );
			return this.getAllCmsOptions()[key] || false;
		};

		// Method for getting image preview (if one is set!) for an instance.
		// Used in the "overview" view of the select overview (as opposed to the list view)
		// Has test: ✔
		passedClass.prototype.getImagePreview = function() {
			return this.getReactiveValue( this.getCmsOption('imgPreviewKey') );
		};

		// Method for returnin the collection which this instance will be saved to.
		// Has test: ✔
		passedClass.getCollection = function() {
			return this.getAllCmsOptions().collection || false;
		};
		passedClass.prototype.getCollection = passedClass.getCollection;

		// Has test: ✔
		passedClass.prototype.save = function( saveOptions, callback ) {

			// check( saveOptions, Object );

			// if (callback)
			// 	check( callback, Function );

			if ( !Meteor.userId() )
				throw new Meteor.Error('reactive-constructor-cms', 'You need to be logged in.' );

			var instance = this;

			if ( !instance.getCollection() )
				throw new Meteor.Error('reactive-constructor-cms', 'No collection defined for: ' + passedClass.constructorName );

			instance.setupCmsFields();

			var firstMessage = Msgs.addMessage('Saving…', 'rc-cms__message--info');

			return Meteor.call('reactive-constructor-cms/save', instance.getDataAsObject(), passedClass.constructorName, saveOptions, function( err, res ) {
				if (err)
					return Msgs.addMessage( err.reason, 'rc-cms__message--error');
				if ( res ){
					Msgs.removeMessage( firstMessage );
					if( res.published )
						Msgs.addMessage('Saved and published!', 'rc-cms__message--success');
					else
						Msgs.addMessage('Saved!', 'rc-cms__message--success');
				}

				// If there is a callback, execute it
				if ( callback )
					return callback( err, res );

				// If the edit page open? Reload it with the new doc.
				if (ReactiveConstructorCmsPlugin.editPageIsOpen()) {
					// If this item is saved for the first time, re-open this doc on save
					return ReactiveConstructorCmsPlugin.editPageGet({
						id: res.edit.id || res.edit,
						constructorName: instance.constructor.constructorName
					});
				}

				return true;

			});

		};

		// Method for removing the published version of a doc
		// Has test: ✔
		passedClass.prototype.unpublish = function( callback ) {

			if ( !Meteor.userId() )
				throw new Meteor.Error('reactive-constructor-cms', 'You need to be logged in.' );

			var instance = this;

			if ( !instance.getCollection() )
				throw new Meteor.Error('reactive-constructor-cms', 'No collection defined for: ' + passedClass.constructorName );

			var firstMessage = Msgs.addMessage('Removing published doc…', 'rc-cms__message--info');

			var mainId = instance.getReactiveValue('mainId');
			// check( mainId, String );

			return Meteor.call('reactive-constructor-cms/unpublish', mainId, passedClass.constructorName, function( err, res ) {
				if (err)
					return Msgs.addMessage( err.reason, 'rc-cms__message--error');
				if ( res ){
					Msgs.removeMessage( firstMessage );
					Msgs.addMessage('Unpublished!', 'rc-cms__message--success');
				}
				if ( res < 1 ) {
					Msgs.removeMessage( firstMessage );
					Msgs.addMessage('There was nothing to unpublish.', 'rc-cms__message--info');
				}

				if ( callback )
					return callback( err, res );

				if (ReactiveConstructorCmsPlugin.editPageIsOpen()){
					return ReactiveConstructorCmsPlugin.editPageGet({ id: instance._id, constructorName: instance.constructor.constructorName });
				}

				return true;

			});

		};

		// Method for removing a saved instance (and all backups!)
		// Has test: ✔
		passedClass.prototype.deleteInstance = function( callback ) {

			if ( !Meteor.userId() )
				throw new Meteor.Error('reactive-constructor-cms', 'You need to be logged in.' );

			if ( !this.getCollection() )
				throw new Meteor.Error('reactive-constructor-cms', 'No collection defined for: ' + passedClass.constructorName );

			var id = this.getDataAsObject()._id;

			// check( id, String );

			Msgs.addMessage('Removing doc…', 'rc-cms__message--info');

			return Meteor.call('reactive-constructor-cms/delete', id, passedClass.constructorName, function( err, res ) {
				if ( err )
					Msgs.addMessage( err.reason, 'rc-cms__message--error');
				if ( res < 1)
					Msgs.addMessage( 'Error: no docs removed.', 'rc-cms__message--error');
				if ( callback )
					return callback( err, res );
				return true;
			});

		};

		// Method for getting the currently published version of this instance
		// Has test: ✔
		passedClass.prototype.getPublishedDoc = function( callback ) {

			// Should this method be protected behind login?
			// Probably not since "published" should mean "open to everyone"?

			if ( !this.getCollection() )
				throw new Meteor.Error('reactive-constructor-cms', 'No collection defined for: ' + passedClass.constructorName );

			var mainId = this.getReactiveValue('mainId');

			// check( mainId, String );

			return Meteor.call('reactive-constructor-cms/get-published-doc', mainId, passedClass.constructorName, function( err, res ) {
				if ( err ){
					Msgs.addMessage('Error while getting published doc: ' + err.reason, 'rc-cms__message--error');
				}
				if ( callback )
					return callback( err, res );
				return true;
			});

		};

		// Method for getting a backup of a doc
		// Has test: ✔
		passedClass.prototype.getBackupDoc = function( version, callback ) {

			if ( !Meteor.userId() )
				throw new Meteor.Error('reactive-constructor-cms', 'You need to be logged in.' );

			if ( !this.getCollection() )
				throw new Meteor.Error('reactive-constructor-cms', 'No collection defined for: ' + passedClass.constructorName );

			// if (callback)
			// 	check( callback, Function );

			// What version of the backup to get.
			// Default is the last one (1)
			version = version || 0;

			// check( version, Number );

			var mainId = this.getReactiveValue('mainId');
			var updateTime = this.getReactiveValue('updateTime') || new Date();

			// check( mainId, String );
			// check( updateTime, Date );

			var firstMessage = Msgs.addMessage('Fetching last backup…', 'rc-cms__message--info');

			return Meteor.call('reactive-constructor-cms/get-backup-doc', mainId, passedClass.constructorName, updateTime, version, function( err, res ) {
				Msgs.removeMessage( firstMessage );
				if ( err ){
					Msgs.addMessage('Error while getting backup: ' + err.reason, 'rc-cms__message--error');
				}
				if ( !res )
					Msgs.addMessage('Can not find more backups of this instance.', 'rc-cms__message--error');
				if ( callback )
					return callback( err, res );
				return true;
			});

		};

		// Method for returning the instance's cmsOptions
		// Has test: ✔
		passedClass.getInstanceCmsOptions = function() {
			// If it's the constrcutor rather than an instance calling this method,
			// just return an empty object.
			if (!this.getType || !this.getType())
				return {};
			return _.findWhere( passedClass.constructorDefaults().typeStructure, {
				type: this.getType()
			}).cmsOptions || {};
		};
		passedClass.prototype.getInstanceCmsOptions = passedClass.getInstanceCmsOptions;

		// Method for returning the constructor's cmsOptions
		// Has test: ✔
		passedClass.getConstructorCmsOptions = function() {
			return passedClass.constructorDefaults().cmsOptions || {};
		};
		passedClass.prototype.getConstructorCmsOptions = passedClass.getConstructorCmsOptions;

		// Method for getting both instance AND constructor cms options
		// Has test: ✔
		passedClass.getAllCmsOptions = function() {

			var cmsOptions = this.getConstructorCmsOptions();
			var instanceTypeCmsOptions = this.getInstanceCmsOptions();

			if (instanceTypeCmsOptions.inputs)
				cmsOptions.inputs  = _.assign( cmsOptions.inputs || {}, instanceTypeCmsOptions.inputs );

			if (instanceTypeCmsOptions.exclude)
				cmsOptions.exclude = _.assign( cmsOptions.exclude || {}, instanceTypeCmsOptions.exclude );

			if (instanceTypeCmsOptions.filter)
				cmsOptions.filter  = _.assign( cmsOptions.filter || {}, instanceTypeCmsOptions.filter );

			if (instanceTypeCmsOptions.imgPreviewKey)
				cmsOptions.imgPreviewKey  = instanceTypeCmsOptions.imgPreviewKey;

			return cmsOptions;

		};
		passedClass.prototype.getAllCmsOptions = passedClass.getAllCmsOptions;

		// Method to check if an instance can be saved
		// Has test: ✔
		passedClass.prototype.canBeSaved = function() {
			return this.getCollection() !== false;
		};

		passedClass.prototype.isSaved = function() {
			return this.getReactiveValue('updateTime');
		};

		// Method for returning all current instances (from the DB)
		// which can be added to a one of this instances' fields (by key)
		// Has test: ✔
		passedClass.prototype.getLinkableInstances = function( key ) {

			// check( key, String );

			var instance = this;
			var constructorName = instance.getConstructorNameOfKey( key );
			var collection = ReactiveConstructorCmsPlugin.getCollectionFromConstructorName( constructorName );

			// If there is no collection, just return an empty array.
			if (!collection)
				return [];

			var items = collection.find({
				reactiveConstructorCmsStatus: 'edit'
			}, {
				transform: doc => new ReactiveConstructors[ constructorName ]( doc )
			}).fetch();

			// We do not want to return this object, so filter away items with this _id
			items = _.reject( items, item => item.getReactiveValue('_id') === instance.getReactiveValue('_id') );

			return instance.filterCreatableTypes( key, items, 'rcType' );

		};

		// Method for filtering a list of types by types defined for the instance
		// Has test: ✔
		passedClass.prototype.filterCreatableTypes = function( key, typeNames, typeNameKey ) {

			// Make sure typeNames are passed
			// check( typeNames, Array );

			var instance = this;

			// Check if this instance type has any filter
	    var instanceCmsOptions = instance.getInstanceCmsOptions();

	    if (instanceCmsOptions.exclude && instanceCmsOptions.exclude[key] )
	    	typeNames = _.reject(typeNames, function( type ){
	    		return _.indexOf( instanceCmsOptions.exclude[key], type[ typeNameKey ] ) > -1;
	    	});

	    if (instanceCmsOptions.filter && instanceCmsOptions.filter[key] )
	    	typeNames = _.filter(typeNames, function( type ){
	    		return _.indexOf( instanceCmsOptions.filter[key], type[ typeNameKey ] ) > -1;
	    	});

	    return typeNames;

		};

		// Return an array of strings of the types which a field
		// can contain. Use the constructor for this, since it's not really
		// bound to the specific instance.
		// Has test: ✔
		passedClass.getCreatableTypes = function( key, instance ) {

			// Get all the instance types from the constructor
	    var typeNames = passedClass.getTypeNames();
	    // Get only the names of the types
	    typeNames = _.map(typeNames, function( name ){
	      return { value: name };
	    });

	    // If no instance is passed, just return all the type names
	    if (instance)
	    	return instance.filterCreatableTypes( key, typeNames, 'value' );

	    return typeNames;

		};

		return passedClass;

	},

	initInstance: function ( instance ) {

		var cmsOptionsInputs = instance.getAllCmsOptions().inputs;

		if (!cmsOptionsInputs)
			return instance;

		_.each( cmsOptionsInputs, function ( input, key ) {
			if (input.initMethod)
				return instance.setReactiveValue( key, input.initMethod( instance.getReactiveValue( key ) ) );
		});

		return instance;

	},

	// Since we don't want to add any fields to ALL new instances, just return an empty object
	pluginTypeStructure: function () {
		return {};
	},

	// This returns all VALID fields (but won't add them to instances, they're just OK).
	validTypeStructureFields: function () {
		return reactiveConstructorCmsExtraInstanceFields;
	}

});

// Method for overriding the default checkReactiveValueType method.
// This overriding is needed due to the nesting of "linked instances"
// which are not of the correct types by default.
// Has test: ✔
ReactiveConstructorCmsPlugin.checkReactiveValueType = function( key, passedValue, ordinaryCheckReactiveValueType ) {

	// Make sure the correct values are passed
	if (passedValue === undefined)
		throw new Meteor.Error('reactive-constructor-cms', 'No passedValue passed to ReactiveConstructorCmsPlugin.checkReactiveValueType()');

	// check( key, String );
	// check( ordinaryCheckReactiveValueType, Function );

	// It could be a linked object! If so: accept it!
	if (passedValue.type && passedValue.type === 'reactive-constructor-cms-linked-item'){
		// check( passedValue, {type: String, constructorName: String, _id: String });
		return true;
	}

	// If an array is passed: remove all items in the array which are of type reactive-constructor-cms-linked-item
	if ( passedValue && (passedValue.constructor === Array ) ){
		passedValue = _.reject(passedValue, function( item ){
			return item && item.type && item.type === 'reactive-constructor-cms-linked-item';
		});
	}

	// Is it a key specific to this plugins added fields?
	// If so: check it against this structure
	if ( reactiveConstructorCmsExtraInstanceFields[ key ] ){
		// check( passedValue, reactiveConstructorCmsExtraInstanceFields[ key ] );
		return true;
	}

	return ordinaryCheckReactiveValueType( key, passedValue );

};

// Method for overriding the default checkReactiveValues method.
// This overriding is needed due to the nesting of "linked instances"
// which are not of the correct types by default.
// Has test: ✔
ReactiveConstructorCmsPlugin.checkReactiveValues = function( dataToCheck, currentTypeStructure, ordinaryCheckReactiveValues ) {

	// Make sure dataToCheck is passed!
	if (!dataToCheck || !currentTypeStructure)
		throw new Meteor.Error('reactive-constructor-cms', 'Missing arguments in ReactiveConstructorCmsPlugin.checkReactiveValues()');

	// check( ordinaryCheckReactiveValues, Function );

	// Exlude all items which have a type of reactive-constructor-cms-linked-item
	dataToCheck = _(dataToCheck).mapValues(function( item ){

		// If an array is passed: remove all items in the array which are linked items
		if ( item && (item.constructor === Array ) ){
			item = _.reject(item, function( arrayItem ){
				return arrayItem && arrayItem.type && arrayItem.type === 'reactive-constructor-cms-linked-item';
			});
		}

		// Is the item a linked instance?
		if (item && item.type && item.type === 'reactive-constructor-cms-linked-item')
			return false;

		// Else return the item
		return item;

	}).pick( _.identity ).value();



	return ordinaryCheckReactiveValues( dataToCheck, _.assign( currentTypeStructure, reactiveConstructorCmsExtraInstanceFields ) );

};

// Method for overriding the default setting of an object/instance to the correct type.
// Used for allowing "linked nestables" (which else would throw errors)
// Has test: ✔
ReactiveConstructorCmsPlugin.setValueToCorrectType = function( instance, value, key, ordinarySetValueToCorrectType ) {

	// Make sure all values are passed
	if (!instance)
		throw new Meteor.Error('reactive-constructor-cms', 'Missing "instance" argument in ReactiveConstructorCmsPlugin.setValueToCorrectType()');

	// check( ordinarySetValueToCorrectType, Function );

	// Is it an linked instance? Just return it!
	if (value && value.type === 'reactive-constructor-cms-linked-item')
		return value;

	// Is it an array with elements?
	if ( value && (value.constructor === Array ) && value.length > 0 ){

		return _.map( value, function ( arrayVal ) {

			// Is it a linked object? Then return it.
			if ( arrayVal.type === 'reactive-constructor-cms-linked-item')
				return arrayVal;

			// Does the array item have a reactive constructor defined?
			// If so: create a new instance from the constructor.
			var constructorName = instance.getCurrentTypeStructure()[key];
			if ( arrayVal && ( arrayVal.constructor === Object ) && ReactiveConstructors[ constructorName[ 0 ].constructorName ] )
				return new ReactiveConstructors[ constructorName[ 0 ].constructorName ]( arrayVal );

			return arrayVal;

		});

	}

	// Run the ordinary method instead!
	return ordinarySetValueToCorrectType( instance, value, key );

};

// TODO: Maybe return an actual Template which gets rendered by whatever is calling this method?
// How to handle removing of existing templates which might exist?
// How to write tests for this?
// Very "side-effecty"
ReactiveConstructorCmsPlugin.getSelectListOverview = function( listItems, constructorName, key, setCallback, instance ) {

  // This is the data which gets passed to the select overview
  var overviewSelectData = {
    headline: 'Select ' + constructorName,
    selectableItems: listItems,
    // This callback accepts a selectedItem which either consists of an object with a .value
    // field, which is used to create a new instance. OR the selectedItem IS the new actual
    // object to be added/linked to the current instance.
    callback: function( selectedItem ) {

    	// Is it a string? Then just return it!
    	if ( constructorName === 'String' ){
    		setCallback( selectedItem.value, instance, key );
    		return overviewSelectData.removeTemplateCallback();
    	}

    	// Handle linking of an exisiting object!
    	if ( selectedItem._id ){
    		var linkedItem = {
    			type: 'reactive-constructor-cms-linked-item',
    			constructorName: selectedItem.constructor.constructorName,
    			_id: selectedItem._id
    		};
    		setCallback( linkedItem, instance, key );
    		return overviewSelectData.removeTemplateCallback();
    	}

    	if ( selectedItem.value ) {
	      // Create a new instance
	      var newItem = new ReactiveConstructors[ constructorName ]({ rcType: selectedItem.value });
	      // Set the item to the key of the parent instance
	      setCallback( newItem, instance, key );
	      return overviewSelectData.removeTemplateCallback();
	    }

    },
    removeTemplateCallback: function() {
      if (renderedCMSSelectOverview){
        Blaze.remove( renderedCMSSelectOverview );
        renderedCMSSelectOverview = false;
      }
      return true;
    }
  };

  // Remove any existing templates!
	overviewSelectData.removeTemplateCallback();

  // If there is only on selectable item, just create an instance from that!
  if ( listItems.length === 1 )
    return overviewSelectData.callback( listItems[0] );

  // Render the view and store it in the var
  renderedCMSSelectOverview = Blaze.renderWithData( Template.editTemplate__selectOverview, overviewSelectData, document.body );
  return renderedCMSSelectOverview;

};

// TODO: Remove these two methods when it feels safe to do so!
ReactiveConstructorCmsPlugin.getInstanceByTypeAndId = () => console.log('DEPRECATED!');
ReactiveConstructorCmsPlugin.getGlobalInstanceStore = () => console.log('DEPRECATED!');
ReactiveConstructorCmsPlugin.updateGlobalInstanceStore = () => console.log('DEPRECATED!');

// How to write tests for this?
// Very "side-effecty"
ReactiveConstructorCmsPlugin.editPageRemove = function( instance, callback ) {

	// Is there a current view? Then hide it!
	if ( renderedCMSView ) {

		Blaze.remove( renderedCMSView );

		// Now we don't have a view, set the var to false.
		renderedCMSView = false;

		// Is a callback provided? Execute it!
		if (callback)
			return callback( instance );

		return true;

	}

	// Is a callback provided? Execute it!
	if (callback)
		return callback( instance );

	// No callback or current view? Return false.
	// TODO: This should never happen. Make some kind of check?
	console.error('editPageRemove() called without callback or renderedCMSView!');
	return false;

};

// How to write tests for this?
// Very "side-effecty"
ReactiveConstructorCmsPlugin.editPageGet = function( arguments ) {

	if (!Meteor.userId())
		throw new Meteor.Error('reactive-constructor-cms', 'You need to be logged in.' );

	// Remove all currently visible messages
	Msgs.removeAllMessages();

	// Remove any currently visible edit templates
	return ReactiveConstructorCmsPlugin.editPageRemove( arguments.instance, () => {

		if (!arguments.instance && (!arguments.constructorName || !arguments.id))
			throw new Meteor.Error('reactive-constructor-cms', 'editPageGet() is called with wrong arguments: ', arguments );

		var templateData = {};

		if ( arguments.instance ) {
			templateData.instance = arguments.instance;
			// Make sure the instance has all the required fields
			templateData.instance.setupCmsFields();
		}
		else {
			templateData = {
				constructorName: arguments.constructorName,
				id: arguments.id
			};
		}

		// Render the edit template
		renderedCMSView = Blaze.renderWithData( Template.editTemplate__wrapper, templateData, document.body );

		// TODO: Make better, use proper classes etc.
		Meteor.setTimeout(function () {
			$('.reactive-constructor-cms__main-wrapper--hidden').removeClass('reactive-constructor-cms__main-wrapper--hidden');
		}, 5 );

	});

};

ReactiveConstructorCmsPlugin.editPageIsOpen = function() {
	return $('.reactive-constructor-cms__main-wrapper').length > 0;
};

// Method for overriding the default setReactiveValue method
// Has test: ✔
ReactiveConstructorCmsPlugin.setReactiveValue = function( instance, key, value, ordinarySetReactiveValueFunction ) {

	var fieldCmsOptions = instance.getCmsOption('inputs')[key];
	if (fieldCmsOptions && fieldCmsOptions.transform){
		value = fieldCmsOptions.transform( value );
	}

	return ordinarySetReactiveValueFunction( instance, key, value );

};
