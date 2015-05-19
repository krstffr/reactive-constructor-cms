// Use this for MongoDB dates
var ISODate = Date;

// This is the view for the CMS
renderedCMSView = false;

// This is the var which will hold the select overview template
renderedCMSSelectOverview = false;

// Fetched instances, use this source to update/get a doc "globally"!
tempCMSInstances = new ReactiveVar([]);

var reactiveConstructorCmsExtraInstanceFields = {
	_id: String,
	reactiveConstructorCmsName: String,
	reactiveConstructorCmsStatus: String,
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
			if ( Match.test( item, Array ) ) {
				
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
			if (this.getInstanceCmsOptions().inputs && this.getInstanceCmsOptions().inputs[key])
				return this.getInstanceCmsOptions().inputs[key].type;
			return false;
		};

		// Method for returning the data for the CMS frontend basically
		// Will not return the fields in reactiveConstructorCmsExtraInstanceFields
		// EXCEPT the reactiveConstructorCmsName
		// Has test: ✔
		passedClass.prototype.getReactiveValuesAsArray = function () {
			var typeStructure = this.getCurrentTypeStructure();
			return _(this.reactiveData.get())
			.map(function( value, key ) {
				// Only return the non CMS fields (EXCEPT reactiveConstructorCmsName!)
				if ( reactiveConstructorCmsExtraInstanceFields[key] === undefined || key === 'reactiveConstructorCmsName' )
					return {
						key: key,
						value: value,
						type: getTypeOfStructureItem( typeStructure[key] )
					};
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
			check( arr, Array );
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
			check( arr, Array );
			
			// Is the move within the size of the array?
			// If not: return true!
			if (newIndex < 0 || newIndex > (arr.length-1))
				return true;

			// …move the item…
			arr.splice( newIndex, 0, arr.splice( oldIndex, 1 )[0] );
			// …and update the array.
			// This extra "reset" to an empty array is because the DOM would not 
			// update correctly sometimes with complex nested instances.
			instance.setReactiveValue( listKey, [] );
			return _.defer(function(){
				return instance.setReactiveValue( listKey, arr );
			});
		};

		// Method for duplicating an item in an array,
		// putting it next to the item we duplicate
		// (an array in the reactive object, found from the passed key)
		// Has test: ✔
		passedClass.prototype.arrayitemDuplicate = function ( listKey, indexToDuplicate ) {
			// Get the array…
			var arr = this.getReactiveValue( listKey );
			check( arr, Array );
			// Get the item we want to duplicate
			var item = arr[indexToDuplicate];
			// Is it an "ordinary" new instance? Or a link to an exisiting DB doc
			if ( Match.test( item.getType, Function) ) {
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

		// Has test: ✔
		passedClass.prototype.getCollection = function() {
			if ( !passedClass.constructorDefaults().cmsOptions || !passedClass.constructorDefaults().cmsOptions.collection)
				return false;
			return passedClass.constructorDefaults().cmsOptions.collection;
		};

		// Has test: ✔
		passedClass.prototype.save = function( saveOptions, callback ) {

			check( saveOptions, Object );
			if (callback)
				check( callback, Function );

			if ( !Meteor.userId() )
				throw new Meteor.Error('reactive-constructor-cms', 'You need to be logged in.' );
			
			if ( !this.getCollection() )
				throw new Meteor.Error('reactive-constructor-cms', 'No collection defined for: ' + passedClass.constructorName );

			var firstMessage = Msgs.addMessage('Saving…', 'rc-cms__message--info');

			return Meteor.call('reactive-constructor-cms/save', this.getDataAsObject(), passedClass.constructorName, saveOptions, function( err, res ) {
				if (err)
					return Msgs.addMessage( err.reason, 'rc-cms__message--error');
				if ( res ){
					Msgs.removeMessage( firstMessage );
					if( res.published )
						Msgs.addMessage('Saved and published!', 'rc-cms__message--success');
					else
						Msgs.addMessage('Saved!', 'rc-cms__message--success');
					ReactiveConstructorCmsPlugin.updateGlobalInstanceStore();
				}
				if ( callback )
					return callback( err, res );
				return true;
			});

		};

		// Method for removing the published version of a doc
		// Has test: ✔
		passedClass.prototype.unpublish = function( callback ) {

			if ( !Meteor.userId() )
				throw new Meteor.Error('reactive-constructor-cms', 'You need to be logged in.' );
			
			if ( !this.getCollection() )
				throw new Meteor.Error('reactive-constructor-cms', 'No collection defined for: ' + passedClass.constructorName );

			var firstMessage = Msgs.addMessage('Removing published doc…', 'rc-cms__message--info');

			var mainId = this.getReactiveValue('mainId');
			check( mainId, String );

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

			check( id, String );

			Msgs.addMessage('Removing doc…', 'rc-cms__message--info');

			return Meteor.call('reactive-constructor-cms/delete', id, passedClass.constructorName, function( err, res ) {
				if ( err )
					Msgs.addMessage( err.reason, 'rc-cms__message--error');
				if ( res < 1)
					Msgs.addMessage( 'Error: no docs removed.', 'rc-cms__message--error');
				if ( res )
					ReactiveConstructorCmsPlugin.updateGlobalInstanceStore();
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

			check( mainId, String );

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

			if (callback)
				check( callback, Function );

			// What version of the backup to get.
			// Default is the last one (1)
			version = version || 0;

			check( version, Number );

			var mainId = this.getReactiveValue('mainId');
			var updateTime = this.getReactiveValue('updateTime') || new Date();

			check( mainId, String );
			check( updateTime, Date );

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
		passedClass.prototype.getInstanceCmsOptions = function() {
			return _.findWhere( passedClass.constructorDefaults().typeStructure, {
				type: this.getType()
			}).cmsOptions || {};
		};

		// Method to check if an instance can be saved
		// Has test: ✔
		passedClass.prototype.canBeSaved = function() {
			return this.getCollection() !== false;
		};

		// Method for returning all current instances (from the DB)
		// which can be added to a one of this instances' fields (by key)
		// Has test: ✔
		passedClass.prototype.getLinkableInstances = function( key ) {

			check( key, String );

			var instance = this;
			var constructorName = instance.getConstructorNameOfKey( key );

			// Get the object which holds all instances (in the items fields)
			// If there is no object, or no items-field, there are no items and return false
			var instanceHolder = _.findWhere( ReactiveConstructorCmsPlugin.getGlobalInstanceStore(), { constructorName: constructorName });
			if (!instanceHolder || !instanceHolder.items)
				return [];

			var items = instanceHolder.items;

			// We do not want to return this object, so filter away items with this _id
			items = _.reject(items, function(item){
				return item._id === instance.getReactiveValue('_id');
			});

			return instance.filterCreatableTypes( key, items, 'rcType' );

		};

		// Method for filtering a list of types by types defined for the instance
		// Has test: ✔
		passedClass.prototype.filterCreatableTypes = function( key, typeNames, typeNameKey ) {

			// Make sure typeNames are passed
			check( typeNames, Array );

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

		// console.log('ReactiveConstructorCmsPlugin: initInstance() ', instance.getType() );

		// If a collection is defined for this constructor, make sure this
		// instance has an _id field
		if (instance.getCollection()) {
			if ( !instance.getReactiveValue('_id') ){
				var _id = Meteor.uuid();
				instance.setReactiveValue('_id', _id );
				instance.setReactiveValue('mainId', _id );
			}

			if ( !instance.getReactiveValue('reactiveConstructorCmsName') )
				instance.setReactiveValue('reactiveConstructorCmsName', 'New ' + instance.getType() );

			instance._id = instance.getReactiveValue('_id');
			instance.reactiveConstructorCmsName = instance.getReactiveValue('reactiveConstructorCmsName');
		}

		return instance;

	},

	pluginTypeStructure: function ( instance ) {
		// Does the instance have a collection?
		// Else don't assign any extra fields
		if ( !instance.getCollection() )
			return {};
		return reactiveConstructorCmsExtraInstanceFields;
	}

});

// Method for overriding the default checkReactiveValueType method.
// This overriding is needed due to the nesting of "linked instances"
// which are not of the correct types by default.
// Has test: ✔
ReactiveConstructorCmsPlugin.checkReactiveValueType = function( passedValue, currentTypeToCheck, ordinaryCheckReactiveValueType ) {

	// Make sure the correct values are passed
	if (passedValue === undefined || !currentTypeToCheck)
		throw new Meteor.Error('reactive-constructor-cms', 'No value passed to ReactiveConstructorCmsPlugin.checkReactiveValueType()');

	check( ordinaryCheckReactiveValueType, Function );

	// It could be a linked object! If so: accept it!
	if (passedValue.type && passedValue.type === 'reactive-constructor-cms-linked-item'){
		check( passedValue, {type: String, constructorName: String, _id: String });
		return true;
	}

	// If an array is passed: remove all items in the array which are of type reactive-constructor-cms-linked-item
	if ( Match.test(passedValue, Array ) ){
		passedValue = _.reject(passedValue, function( item ){
			return item && item.type && item.type === 'reactive-constructor-cms-linked-item';
		});
	}

	return ordinaryCheckReactiveValueType( passedValue, currentTypeToCheck );

};

// Method for overriding the default checkReactiveValues method.
// This overriding is needed due to the nesting of "linked instances"
// which are not of the correct types by default.
// Has test: ✔
ReactiveConstructorCmsPlugin.checkReactiveValues = function( dataToCheck, currentTypeStructure, ordinaryCheckReactiveValues ) {

	// Make sure dataToCheck is passed!
	if (!dataToCheck || !currentTypeStructure)
		throw new Meteor.Error('reactive-constructor-cms', 'Missing arguments in ReactiveConstructorCmsPlugin.checkReactiveValues()');

	check( ordinaryCheckReactiveValues, Function );

	// Exlude all items which have a type of reactive-constructor-cms-linked-item
	dataToCheck = _(dataToCheck).mapValues(function( item ){

		// If an array is passed: remove all items in the array which are linked items
		if ( Match.test(item, Array ) ){
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
	
	return ordinaryCheckReactiveValues( dataToCheck, currentTypeStructure );

};

// Method for overriding the default setting of an object/instance to the correct type.
// Used for allowing "linked nestables" (which else would throw errors)
// Has test: ✔
ReactiveConstructorCmsPlugin.setValueToCorrectType = function( instance, value, key, ordinarySetValueToCorrectType ) {

	// Make sure all values are passed
	if (!instance)
		throw new Meteor.Error('reactive-constructor-cms', 'Missing "instance" argument in ReactiveConstructorCmsPlugin.setValueToCorrectType()');

	check( ordinarySetValueToCorrectType, Function );

	// Is it an linked instance? Just return it!
	if (value && value.type === 'reactive-constructor-cms-linked-item')
		return value;

	// Is it an array with elements?
	if ( Match.test(value, Array ) && value.length > 0 ){

		return _.map( value, function ( arrayVal ) {

			// Is it a linked object? Then return it.
			if ( arrayVal.type === 'reactive-constructor-cms-linked-item')
				return arrayVal;

			// Does the array item have a reactive constructor defined?
			// If so: create a new instance from the constructor.
			var constructorName = instance.getCurrentTypeStructure()[key];
			if ( Match.test( arrayVal, Object ) && ReactiveConstructors[ constructorName[ 0 ].constructorName ] )
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
    	if ( selectedItem._id ){
    		// Handle linking of an exisiting object!
    		var linkedItem = {
    			type: 'reactive-constructor-cms-linked-item',
    			constructorName: selectedItem.constructor.constructorName,
    			_id: selectedItem._id
    		};
    		setCallback( linkedItem, instance, key );
    	}
    	if ( selectedItem.value ) {
	      // Create a new instance
	      var newItem = new ReactiveConstructors[ constructorName ]({ rcType: selectedItem.value });
	      // Set the item to the key of the parent instance
	      setCallback( newItem, instance, key );
	    }
      // Remove the template
      return overviewSelectData.removeTemplateCallback();
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

// Has test: ✔
ReactiveConstructorCmsPlugin.getInstanceByTypeAndId = function( constructorName, _id ) {
	
	check( constructorName, String );
	check( _id, String );

	var items = _.findWhere(ReactiveConstructorCmsPlugin.getGlobalInstanceStore(), { constructorName: constructorName }).items;

	return _.findWhere(items, { _id: _id });

};

// Has test: ✔
ReactiveConstructorCmsPlugin.getGlobalInstanceStore = function() {
	return tempCMSInstances.get();
};

// Has test: ✔
ReactiveConstructorCmsPlugin.updateGlobalInstanceStore = function() {

	// console.log( 'ReactiveConstructorCmsPlugin.updateGlobalInstanceStore()' );

  // Setup the "global store" of cool reactive instances!
  var globalData =_.chain(ReactiveConstructors)
  .filter(function( constructor ){
    return constructor.constructorDefaults().cmsOptions && constructor.constructorDefaults().cmsOptions.collection;
  })
  .map(function( constructor ){
    return {
      constructorName: constructor.constructorName,
      items: _.map( constructor.constructorDefaults().cmsOptions.collection.find({ reactiveConstructorCmsStatus: 'edit' }).fetch(), function( instanceData ) {
        return new ReactiveConstructors[ constructor.constructorName ]( instanceData );
      })
    };
  })
  .value();

  tempCMSInstances.set( globalData );

  return ReactiveConstructorCmsPlugin.getGlobalInstanceStore();

};

// How to write tests for this?
// Very "side-effecty"
ReactiveConstructorCmsPlugin.editPageRemove = function( instance, callback ) {

	if (callback)
		check( callback, Function );

	// Is there a current view? Then hide it!
	if ( renderedCMSView ) {

		// Hide the container by adding the hidden class
		// TODO: Use a more proper class
		$('.reactive-constructor-cms-wrapper').addClass('wrapper--hidden');

		// Return a time out which actually remove the view
		return Meteor.setTimeout(function () {
			Blaze.remove( renderedCMSView );
			// Now we don't have a view, set the var to false.
			renderedCMSView = false;
			// Is a callback provided? Execute it!
			if (callback)
				return callback( instance );

		}, 200 );
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
ReactiveConstructorCmsPlugin.editPageGet = function( instance ) {

	if (!Meteor.userId())
		throw new Meteor.Error('reactive-constructor-cms', 'You need to be logged in.' );

	check( instance, ReactiveConstructors[ instance.constructor.constructorName ] );

	// Remove all currently visible messages
	Msgs.removeAllMessages();

	// Remove any currently visible edit templates
	return ReactiveConstructorCmsPlugin.editPageRemove( instance, function( instance ) {

		// Render the edit template
		renderedCMSView = Blaze.renderWithData( Template.editTemplate__wrapper, instance, document.body );

		// TODO: Make better, use proper classes etc.
		Meteor.setTimeout(function () {
			$('.wrapper--hidden').removeClass('wrapper--hidden');
		}, 5 );

	});

};