renderedCMSView = false;

var TEMPcmsPlugin = new ReactiveConstructorPlugin({

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
			// Use the items .constructor and .getDataAsObject() methods to create a copy
			// and push this to the array
			arr.push( new item.constructor( item.getDataAsObject() ) );
			// Update the array…
			this.setReactiveValue( listKey, arr );
			// …and move the item to the position after the one being copied
			return this.arrayitemMove( listKey, (indexToDuplicate+1), (this.getReactiveValue( listKey ).length - 1) );
		};

		passedClass.prototype.save = function() {
			
			if (!this.collection)
				throw new Meteor.Error('temp-cms', 'No collection defined for: ' + this.rcType );

			console.log('saving: ', this );

		};

		// Method for removing the currently visible CMS view (if there is one)
		passedClass.prototype.editPageRemove = function ( callback ) {
			
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

			// Remove any currently visible edit templates
			return this.editPageRemove( function() {

				console.log( this );

				// Render the edit template
				renderedCMSView = Blaze.renderWithData( Template.editTemplate__wrapper, this, document.body );

				// TODO: Make better, use proper classes etc.
				Meteor.setTimeout(function () {
					$('.wrapper--hidden').removeClass('wrapper--hidden');
				}, 5 );

			});

		};

		return passedClass;

	},

	initInstance: function ( instance ) {

		console.log('TEMPcmsPlugin: initInstance() ', instance.getType() );

		return instance;

	}

});