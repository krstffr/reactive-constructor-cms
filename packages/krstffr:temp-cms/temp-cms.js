var TEMPcmsPlugin = new ReactiveConstructorPlugin({

	initClass: function ( passedClass ) {

		// Method for returning the type of an item as a string.
		getTypeOfStructureItem = function ( item ) {
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

		passedClass.prototype.save = function() {
			
			if (!this.collection)
				throw new Meteor.Error('temp-cms', 'No collection defined for: ' + this.rcType );

			console.log('saving!');
			console.log( this );

		};

		passedClass.prototype.editPageGet = function() {
			Blaze.renderWithData( Template.editTemplate__wrapper, this, document.body );
		};

		return passedClass;

	},

	initInstance: function ( instance ) {

		// console.log( 'running initInstance() on: ', instance );

		return instance;

	}

});