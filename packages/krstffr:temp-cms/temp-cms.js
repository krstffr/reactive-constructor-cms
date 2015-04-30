// Use this for MongoDB dates
var ISODate = Date;

// This is the view for the CMS
renderedCMSView = false;

// This is the var which will hold the select overview template
renderedCMSSelectOverview = false;

// Fetched instances, use this source to update/get a doc "globally"!
tempCMSInstances = new ReactiveVar([]);

TEMPcmsPlugin = new ReactiveConstructorPlugin({

	initConstructor: function ( passedClass ) {

		console.log('TEMPcmsPlugin: initConstructor() ', passedClass.name );

		// Method for returning the type of an item as a string.
		var getTypeOfStructureItem = function ( item ) {
			// Does the item actaully have a name?
			// Then it's probably a String or a Number or a Boolean, return it
			if (item.name)
				return item.name;

			// Is it an array?
			if ( Match.test( item, Array ) ) {
				
				// Does it have any items?
				if (item.length > 1)
					return 'Array';

				return 'Collection_'+item[0].name;
			}
		};

		// Method for returning the data for the CMS frontend basically
		passedClass.prototype.getReactiveValuesAsArray = function () {
			var typeStructure = this.getCurrentTypeStructure();
			return _.map( this.reactiveData.get(), function( value, key ) {
				return {
					key: key,
					value: value,
					type: getTypeOfStructureItem( typeStructure[key] )
				};
			});
		};

		// Method for removing item from an array
		// (an array in the reactive object, found from the passed key)
		passedClass.prototype.arrayitemRemove = function ( listKey, indexToRemove ) {
			// Get the array…
			var arr = this.getReactiveValue( listKey );
			// …remove the item…
			arr.splice( indexToRemove, 1 );
			// …and update the array.
			return this.setReactiveValue( listKey, arr );
		};

		// Method for moving an item in an array
		// (an array in the reactive object, found from the passed key)
		passedClass.prototype.arrayitemMove = function ( listKey, newIndex, oldIndex ) {
			// Get the array…
			var arr = this.getReactiveValue( listKey );
			// …move the item…
			arr.splice( newIndex, 0, arr.splice( oldIndex, 1 )[0] );
			// …and update the array.
			return this.setReactiveValue( listKey, arr );
		};

		// Method for duplicating an item in an array,
		// putting it next to the item we duplicate
		// (an array in the reactive object, found from the passed key)
		passedClass.prototype.arrayitemDuplicate = function ( listKey, indexToDuplicate ) {
			// Get the array…
			var arr = this.getReactiveValue( listKey );
			// Get the item we want to duplicate
			var item = arr[indexToDuplicate];
			// Use the .getDataAsObject() method to get this items data, and also add this instances type
			var newItemData = _.assign({ rcType: item.getType() }, item.getDataAsObject() );
			// Use the items .constructor to create a new instance and push this to the array
			arr.push( new item.constructor( newItemData ) );
			// Update the array…
			this.setReactiveValue( listKey, arr );
			// …and move the item to the position after the one being copied
			return this.arrayitemMove( listKey, (indexToDuplicate+1), (this.getReactiveValue( listKey ).length - 1) );
		};

		passedClass.prototype.getCollection = function() {
			if ( !passedClass.constructorDefaults().cmsOptions || !passedClass.constructorDefaults().cmsOptions.collection)
				return false;
			return passedClass.constructorDefaults().cmsOptions.collection;
		};

		passedClass.prototype.save = function( saveOptions, callback ) {
			
			if ( !this.getCollection() )
				throw new Meteor.Error('temp-cms', 'No collection defined for: ' + passedClass.name );

			console.log( this.getDataAsObject() );

			return Meteor.call('rc-temp-cms/save', this.getDataAsObject(), passedClass.name, saveOptions, function(err, res) {
				
				console.log( err, res );

				if ( res )
					TEMPcmsPlugin.updateGlobalInstanceStore();
				if (callback)
					return callback( res );
				return true;
			});

		};

		passedClass.prototype.deleteInstance = function( callback ) {
			
			if ( !this.getCollection() )
				throw new Meteor.Error('temp-cms', 'No collection defined for: ' + passedClass.name );

			var id = this.getDataAsObject()._id;

			check( id, String );
			check( passedClass.name, String );

			return Meteor.call('rc-temp-cms/delete', id, passedClass.name, function(err, res) {
				
				console.log( err, res );

				if ( res )
					TEMPcmsPlugin.updateGlobalInstanceStore();
				if ( callback )
					return callback( res );
				return true;
			});

		};

		// Method for removing the currently visible CMS view (if there is one)
		passedClass.prototype.editPageRemove = function ( callback ) {

			throw new Meteor.Error('DEPRECATED', 'NOPE: DO NOT USE!');

			var instanceContext = this;

			// Is there a current view? Then hide it!
			if ( renderedCMSView ) {

				// Hide the container by adding the hidden class
				// TODO: Use a more proper class
				$('.wrapper').addClass('wrapper--hidden');

				// Return a time out which actually remove the view
				return Meteor.setTimeout(function () {
					Blaze.remove( renderedCMSView );
					// Now we don't have a view, set the var to false.
					renderedCMSView = false;
					// Is a callback provided? Execute it!
					if (callback)
						return callback.call( instanceContext );
				}, 200 );
			}

			// Is a callback provided? Execute it!
			if (callback)
				return callback.call( instanceContext );

			// No callback or current view? Return false.
			// TODO: This should never happen. Make some kind of check?
			console.error('editPageRemove() called without callback or renderedCMSView!');
			return false;

		};

		// Method for getting (and showing) the current CMS view
		passedClass.prototype.editPageGet = function() {

			throw new Meteor.Error('DEPRECATED', 'NOPE: DO NOT USE!');

			// Remove any currently visible edit templates
			return this.editPageRemove( function() {

				// Render the edit template
				renderedCMSView = Blaze.renderWithData( Template.editTemplate__wrapper, this, document.body );

				// TODO: Make better, use proper classes etc.
				Meteor.setTimeout(function () {
					$('.wrapper--hidden').removeClass('wrapper--hidden');
				}, 5 );

			});

		};

		// Method for returning the instance's cmsOptions
		passedClass.prototype.getInstanceCmsOptions = function() {
			return _.findWhere( passedClass.constructorDefaults().typeStructure, {
				type: this.getType()
			}).cmsOptions || {};
		};

		// Method for returning all current instances (from the DB)
		// which can be added to a one of this instances' fields (by key)
		passedClass.prototype.getLinkableInstances = function( key ) {
			console.log( key );
		};

		// Return an array of strings of the types which a field
		// can contain. Use the constructor for this, since it's not really
		// bound to the specific instance.
		// TODO: This description is not great at all.
		passedClass.getCreatableTypes = function( key, instance ) {

			// Get all the instance types from the constructor
	    var constructorNames = passedClass.getTypeNames();
	    // Get only the names of the types
	    constructorNames = _.map(constructorNames, function( name ){
	      return { value: name };
	    });

	    if (!instance)
	    	return constructorNames;

	    // Check if this instance type has any filter
	    var instanceCmsOptions = instance.getInstanceCmsOptions();

	    if (instanceCmsOptions.exclude && instanceCmsOptions.exclude[key] )
	    	constructorNames = _.reject(constructorNames, function( type ){
	    		return _.indexOf( instanceCmsOptions.exclude[key], type.value ) > -1;
	    	});

	    if (instanceCmsOptions.filter && instanceCmsOptions.filter[key] )
	    	constructorNames = _.filter(constructorNames, function( type ){
	    		return _.indexOf( instanceCmsOptions.filter[key], type.value ) > -1;
	    	});

	    return constructorNames;

		};

		return passedClass;

	},

	initInstance: function ( instance ) {

		console.log('TEMPcmsPlugin: initInstance() ', instance.getType() );

		// If a collection is defined for this constructor, make sure this
		// instance has an _id field
		if ( instance.getCollection() && !instance.getReactiveValue('_id') )
			instance.setReactiveValue('_id', Meteor.uuid() );

		instance._id = instance.getReactiveValue('_id');

		return instance;

	},

	pluginTypeStructure: {
		_id: String,
		tempCmsStatus: String,
		updateTime: ISODate
	}

});

// TODO: Maybe return an actual Template which gets rendered by whatever is calling this method?
// How to handle removing of existing templates which might exist?
TEMPcmsPlugin.getSelectListOverview = function( listItems, constructorName, key, setCallback, instance ) {

  // This is the data which gets passed to the select overview
  var overviewSelectData = {
    headline: 'Select type of ' + constructorName,
    selectableItems: listItems,
    callback: function( selectedItem ) {
      // Create a new instance
      var newItem = new ReactiveConstructors[ constructorName ]({ rcType: selectedItem });
      // Set the item to the key of the parent instance
      setCallback( newItem, instance, key );
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

  // If there is only on selectable item, just create an instance from that!
  if ( listItems.length === 1 )
    return overviewSelectData.callback( listItems[0].value );
  
  // Render the view and store it in the var
  renderedCMSSelectOverview = Blaze.renderWithData( Template.editTemplate__selectOverview, overviewSelectData, document.body );
  return renderedCMSSelectOverview;

};

TEMPcmsPlugin.getInstanceByTypeAndId = function( constructorName, _id ) {
	
	check( constructorName, String );
	check( _id, String );

	var items = _.findWhere(TEMPcmsPlugin.getGlobalInstanceStore(), { constructorName: constructorName }).items;

	return _.findWhere(items, { _id: _id });

};

TEMPcmsPlugin.getGlobalInstanceStore = function() {
	return tempCMSInstances.get();
};

TEMPcmsPlugin.updateGlobalInstanceStore = function() {

	console.log( 'TEMPcmsPlugin.updateGlobalInstanceStore()' );

  // Setup the "global store" of cool reactive instances!
  var globalData =_.chain(ReactiveConstructors)
  .filter(function( constructor ){
    return constructor.constructorDefaults().cmsOptions && constructor.constructorDefaults().cmsOptions.collection;
  })
  .map(function( constructor ){
    return {
      constructorName: constructor.name,
      items: _.map( constructor.constructorDefaults().cmsOptions.collection.find({ tempCmsStatus: 'edit' }).fetch(), function( instanceData ) {
        return new ReactiveConstructors[ constructor.name ]( instanceData );
      })
    };
  })
  .value();

  return tempCMSInstances.set( globalData );

};

TEMPcmsPlugin.editPageRemove = function( instance, callback ) {

	if (callback)
		check( callback, Function );

	// Is there a current view? Then hide it!
	if ( renderedCMSView ) {

		// Hide the container by adding the hidden class
		// TODO: Use a more proper class
		$('.wrapper').addClass('wrapper--hidden');

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

TEMPcmsPlugin.editPageGet = function( instance ) {

	check( instance, ReactiveConstructors[ instance.constructor.name ] );

	// Remove any currently visible edit templates
	return TEMPcmsPlugin.editPageRemove( instance, function( instance ) {

		// Render the edit template
		renderedCMSView = Blaze.renderWithData( Template.editTemplate__wrapper, instance, document.body );

		// TODO: Make better, use proper classes etc.
		Meteor.setTimeout(function () {
			$('.wrapper--hidden').removeClass('wrapper--hidden');
		}, 5 );

	});

};