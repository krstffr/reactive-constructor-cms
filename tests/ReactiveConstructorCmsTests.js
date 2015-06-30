Persons = new Meteor.Collection('persons');
Animals = new Meteor.Collection('animals');

Meteor.startup(function() {

	Client = new ReactiveConstructor('Client', function() {
		return {
			typeStructure: [{
				type: 'instance with instance cmsOptions',
				fields: {
					clientBackground: String
				},
				cmsOptions: {
					inputs: {
						clientBackground: {
							type: 'textarea'
						}
					},
				}
			}]
		};
	});

	Person = new ReactiveConstructor('Person', function () {
		return {
			cmsOptions: {
				collection: Persons
			},
			globalValues: {
				fields: {
					age: Number,
					name: String,
					children: [ Person ],
					sex: String
				}
			},
			typeStructure: [{
				type: 'worker',
				fields: {
					title: String,
					portraitUrl: String,
					pets: [ Animal ],
					bestFriend: Person
				},
				defaultData: {
					name: 'Kristoffer Klintberg',
					title: 'Designer',
					age: 30,
					children: [],
					portraitUrl: 'http://portra.wpshower.com/wp-content/uploads/2014/03/martin-schoeller-barack-obama-portrait-up-close-and-personal.jpg'
				},
				cmsOptions: {
					imgPreviewKey: 'portraitUrl',
					inputs: {
						name: {
							type: 'textarea'
						}
					},
					filter: {
						children: ['worker', 'child']
					}
				}
			}, {
				type: 'husband',
				fields: {
					wife: Person,
					buddies: [ Person ],
					happy: Boolean
				},
				defaultData: {
					age: 49,
					sex: 'male',
					happy: true
				},
				cmsOptions: {
					filter: {
						wife: ['wife']
					},
					exclude: {
						buddies: ['wife', 'child'],
						children: ['wife', 'husband']
					}
				}
			}, {
				type: 'wife',
				fields: {
					happy: Boolean,
					bff: Person
				},
				defaultData: {
					age: 54,
					sex: 'female',
					happy: false
				},
				cmsOptions: {
					exclude: {
						bff: ['husband', 'child']
					}
				}
			}, {
				type: 'child',
				defaultData: {
					age: 18
				},
				methods: {
					isTeenager: function () {
						var age = this.getReactiveValue('age');
						return age > 12 && age < 20;
					},
					getAgePlus: function ( years ) {
						check( years, Number );
						return this.getReactiveValue('age') + years;
					},
					addYears: function ( years ) {
						check( years, Number );
						var age = this.getReactiveValue('age');
						return this.setReactiveValue('age', age + years );
					}
				}
			}]
		}; 
	});

	Animal = new ReactiveConstructor('Animal', function() {
		return {
			cmsOptions: {
				collection: Animals
			},
			typeStructure: [{
				type: 'dog',
				fields: {
					name: String,
					hungry: Boolean,
					owner: Person
				}
			}]
		};
	});

	NonSaveableConstructor = new ReactiveConstructor('NonSaveableConstructor', function() {
		return {
			typeStructure: [{
				type: 'this is a non saveable instance'
			}]
		};
	});

	WebPage = new ReactiveConstructor('WebPage', function() {
		return {
			typeStructure: [{
				type: 'webPage',
				fields: {
					url: String
				},
				cmsOptions: {
					inputs: {
						url: {
							transform: function( value ) {
								value += ' overridden!';
								console.log( value );
								return value;
							}
						}
					}
				}
			}]
		};
	});

});

if (Meteor.isServer){
	Meteor.methods({
		'reactive-constructor-cms/cleanup-test-db': function() {
			console.log('removing all persons AND animals from DB…');
			return Persons.remove({}) && Animals.remove({});
		}
	});
	return false;
}

var accountCreated = false;
var loginOrCreateAccount = function( cb ) {
	
	var username = 'test-user';
	var password = 'test-pass';

	if (!accountCreated){
		return Accounts.createUser({ username: username, password: password }, function() {
			accountCreated = true;
			// Now login as well!
			return loginOrCreateAccount( cb );
		});
	}
	else {
		Meteor.loginWithPassword(username, password, function() {
			return cb();
		});
	}

};

var startSubscription = function( cb ) {
	Meteor.subscribe('reactive-constructor-cms__editable-docs', {
		onReady: function() {
			cb();
		}
	});
};

Tinytest.add('ReactiveConstructorCmsPlugin - init: main object and all methods exists', function(test) {

	test.isTrue( Match.test( ReactiveConstructorCmsPlugin, ReactiveConstructorPlugin ) );

	test.isTrue( Match.test( ReactiveConstructorCmsPlugin.checkReactiveValueType, Function ) );
	test.isTrue( Match.test( ReactiveConstructorCmsPlugin.checkReactiveValues, Function ) );
	test.isTrue( Match.test( ReactiveConstructorCmsPlugin.setValueToCorrectType, Function ) );
	test.isTrue( Match.test( ReactiveConstructorCmsPlugin.getSelectListOverview, Function ) );
	test.isTrue( Match.test( ReactiveConstructorCmsPlugin.getInstanceByTypeAndId, Function ) );
	test.isTrue( Match.test( ReactiveConstructorCmsPlugin.getGlobalInstanceStore, Function ) );
	test.isTrue( Match.test( ReactiveConstructorCmsPlugin.updateGlobalInstanceStore, Function ) );
	test.isTrue( Match.test( ReactiveConstructorCmsPlugin.editPageRemove, Function ) );
	test.isTrue( Match.test( ReactiveConstructorCmsPlugin.editPageGet, Function ) );

});

Tinytest.add('ReactiveConstructorCmsPlugin - init: new instances should be able to have Boolean fields set to false', function(test) {

	var fedAnimal = new Animal({ hungry: false });
	var hungryAnimal = new Animal({ hungry: true });

	console.log( hungryAnimal.getReactiveValue('hungry') );
	console.log( fedAnimal.getReactiveValue('hungry') );

	test.isTrue( hungryAnimal.getReactiveValue('hungry') );
	test.isFalse( fedAnimal.getReactiveValue('hungry') );

});

Tinytest.add('ReactiveConstructorCmsPlugin overrides - checkReactiveValueType()', function(test) {

	var correctLinkObject = {type: 'reactive-constructor-cms-linked-item', constructorName: 'Person', _id: 'a proper id' };

	// Should fail if not passing correct arguments
	test.throws(function () {
		ReactiveConstructorCmsPlugin.checkReactiveValueType();
	});
	test.throws(function () {
		ReactiveConstructorCmsPlugin.checkReactiveValueType('firstVal');
	});
	test.throws(function () {
		ReactiveConstructorCmsPlugin.checkReactiveValueType('firstVal', Object);
	});
	test.throws(function () {
		ReactiveConstructorCmsPlugin.checkReactiveValueType('firstVal', Object, 'Wrong type');
	});

	// Passing a proper linked object should return true
	test.isTrue( ReactiveConstructorCmsPlugin.checkReactiveValueType('shit', correctLinkObject, function() {}) );

	// Passing an array with a linked object should pass an empty array to the default method
	ReactiveConstructorCmsPlugin.checkReactiveValueType('shit', [ correctLinkObject ], function( key, passedValue ) {
		test.equal(key, 'shit');
		test.equal(passedValue, []);
	});

	// Passing an array with an "ordinary" constructor should pass an array with the constructor
	// to the default method
	ReactiveConstructorCmsPlugin.checkReactiveValueType('shit', [ Person ], function( key, passedValue ) {
		test.equal(passedValue, [Person]);
	});

});

Tinytest.add('ReactiveConstructorCmsPlugin overrides - checkReactiveValues()', function(test) {

	// Should fail if not passing correct arguments
	test.throws(function () {
		ReactiveConstructorCmsPlugin.checkReactiveValues();
	});
	test.throws(function () {
		ReactiveConstructorCmsPlugin.checkReactiveValues('firstVal');
	});
	test.throws(function () {
		ReactiveConstructorCmsPlugin.checkReactiveValues('firstVal', Object);
	});
	test.throws(function () {
		ReactiveConstructorCmsPlugin.checkReactiveValues('firstVal', Object, 'Wrong type');
	});

	var ordinaryStructure = {
		persons: [ Person ],
		wife: Person,
		something: String
	};
	var ordinaryInstance = {
		persons: [ new Person() ],
		wife: new Person(),
		something: 'hej'
	};

	ReactiveConstructorCmsPlugin.checkReactiveValues( ordinaryInstance, ordinaryStructure, function( dataToCheck, currentTypeStructure ) {
		test.equal( ordinaryInstance, dataToCheck );
		test.equal( ordinaryStructure, currentTypeStructure );
	});

	var correctLinkObject = {type: 'reactive-constructor-cms-linked-item', constructorName: 'Person', _id: 'a proper id' };
	var linkInstance = {
		persons: [ correctLinkObject ],
		wife: correctLinkObject,
		something: 'hej'
	};

	ReactiveConstructorCmsPlugin.checkReactiveValues( linkInstance, ordinaryStructure, function( dataToCheck, currentTypeStructure ) {
		test.equal( dataToCheck.persons, [] );
		test.isUndefined( dataToCheck.wife );
		test.equal( ordinaryStructure, currentTypeStructure );
	});

});

Tinytest.add('ReactiveConstructorCmsPlugin overrides - setReactiveValue() with transform', function(test) {

	var testWebPage = new WebPage();

	testWebPage.setReactiveValue( 'url', 'A super cool url' );

	test.equal( testWebPage.getReactiveValue('url'), 'A super cool url overridden!' );

});

Tinytest.add('ReactiveConstructorCmsPlugin overrides - setValueToCorrectType', function(test) {

	// Not passing the correct arguments should throw errors
	test.throws(function() {
		ReactiveConstructorCmsPlugin.setValueToCorrectType();
	});
	test.throws(function() {
		ReactiveConstructorCmsPlugin.setValueToCorrectType(1,2,3,'not a function');
	});

	// Make sure correct values are passed through the way they should
	var instance = new Person({ rcType: 'husband' });
	var wifeObject = { rcType: 'wife '};
	ReactiveConstructorCmsPlugin.setValueToCorrectType(instance, wifeObject, 'wife', function( passedInstance, value, key ) {
		test.equal( value, wifeObject );
		test.equal( key, 'wife' );
		test.equal( passedInstance, instance );
	});

	// Make sure a linked value is passed through the way it should
	var linkedWife = { type: 'reactive-constructor-cms-linked-item', constructorName: 'Person', _id: 'a proper id' };
	ReactiveConstructorCmsPlugin.setValueToCorrectType(instance, linkedWife, 'wife', function( passedInstance, value, key ) {
		test.equal( value, linkedWife );
		test.equal( key, 'wife' );
		test.equal( passedInstance, instance );
	});

	// Make sure an array of both linked and "ordinary" values are passed through the way it should
	var buddies = [ { rcType: 'husband' }, linkedWife ];
	ReactiveConstructorCmsPlugin.setValueToCorrectType(instance, buddies, 'buddies', function( passedInstance, value, key ) {
		test.equal( value, buddies );
		test.equal( key, 'buddies' );
		test.equal( passedInstance, instance );
	});

});

Tinytest.add('ReactiveConstructorCmsPlugin instance methods - getCollection', function(test) {

	var testPerson = new Person();

	test.isTrue( Match.test( testPerson.getCollection(), Mongo.Collection ) );
	test.equal( testPerson.getCollection(), Persons );

	var docWithNoCollection = new NonSaveableConstructor();
	test.isFalse( docWithNoCollection.getCollection() );

});

Tinytest.add('ReactiveConstructorCmsPlugin instance methods - instance.save(), throw error for non saveable', function(test) {

	var docToFail = new NonSaveableConstructor();

	test.throws(function() {
		docToFail.save({});
	});

});

Tinytest.add('ReactiveConstructorCmsPlugin instance methods - instance.deleteInstance(), throw error for non saveable', function(test) {

	var docToFail = new NonSaveableConstructor();

	test.throws(function() {
		docToFail.deleteInstance();
	});

});

Tinytest.add('ReactiveConstructorCmsPlugin instance methods - instance.arrayitemDuplicate()', function(test) {
	
	var person = new Person({ rcType: 'husband', buddies: [{}, { name: 'john' }, {}]});
	var buddies = person.getReactiveValue('buddies');

	test.equal( buddies[1].getReactiveValue('name'), 'john');
	test.notEqual( buddies[2].getReactiveValue('name'), 'john');
	test.equal( buddies.length, 3 );

	// Dupliace John!
	person.arrayitemDuplicate( 'buddies', 1 );

	test.equal( buddies[1].getReactiveValue('name'), 'john');
	test.equal( buddies[2].getReactiveValue('name'), 'john');
	test.equal( buddies.length, 4 );

	test.throws(function() {
		// 'wife' is not an array, so it should throw an error
		person.arrayitemDuplicate( 'wife', 1 );
	});

});

Tinytest.add('ReactiveConstructorCmsPlugin instance methods - instance.arrayitemRemove()', function(test) {
	
	var person = new Person({ rcType: 'husband', buddies: [{}, { name: 'john' }, {}]});
	var buddies = person.getReactiveValue('buddies');

	test.equal( buddies[1].getReactiveValue('name'), 'john');
	test.notEqual( buddies[2].getReactiveValue('name'), 'john');
	test.equal( buddies.length, 3 );

	// Move John! Now he should be at place 2 instead of 1
	person.arrayitemRemove( 'buddies', 1 );

	test.notEqual( buddies[1].getReactiveValue('name'), 'john');
	test.equal( buddies.length, 2 );

	test.throws(function() {
		// 'wife' is not an array, so it should throw an error
		person.arrayitemRemove( 'wife', 1 );
	});

});

Tinytest.add('ReactiveConstructorCmsPlugin instance methods - instance.getReactiveValuesAsArray()', function(test) {
	
	var person = new Person({
		rcType: 'husband',
		buddies: [{}, { name: 'john' }, {}],
		wife: { rcType: 'wife' }
	});

	var keys = _.keys( person.getDataAsObject() );

	// All keys should be in the keys we get from getDataAsObject()
	_.each( person.getReactiveValuesAsArray(), function(value){
		test.isTrue( _.indexOf(keys, value.key) > -1 );
	});

});

Tinytest.add('ReactiveConstructorCmsPlugin instance methods - instance.getInstanceCmsOptions()', function(test) {
	
	var person = new Person({
		rcType: 'husband',
		buddies: [{}, { name: 'john' }, {}],
		wife: { rcType: 'wife' }
	});

	test.isTrue( Match.test( person.getInstanceCmsOptions(), { exclude: Object, filter: Object }) );

	var nonSaveableInstance = new NonSaveableConstructor();

	// This should just be an empty object
	test.isTrue( Match.test( nonSaveableInstance.getInstanceCmsOptions(), {} ) );

});

Tinytest.add('ReactiveConstructorCmsPlugin instance methods - instance.getConstructorCmsOptions()', function(test) {
	
	var person1 = new Person({ rcType: 'husband' });
	var person2 = new Person({ rcType: 'worker' });

	test.equal( person1.getConstructorCmsOptions(), person2.getConstructorCmsOptions() );

	var animal = new Animal();

	test.equal( animal.getConstructorCmsOptions().collection, Animals );

	var instanceWithNoOptions = new NonSaveableConstructor();

	test.equal( instanceWithNoOptions.getConstructorCmsOptions(), {} );

});

Tinytest.add('ReactiveConstructorCmsPlugin instance methods - instance.getAllCmsOptions()', function(test) {
	
	var person1 = new Person({ rcType: 'husband' });
	var person2 = new Person({ rcType: 'worker' });

	test.equal( person1.getAllCmsOptions().collection, person2.getAllCmsOptions().collection );
	test.notEqual( person1.getAllCmsOptions(), person2.getAllCmsOptions() );

	var animal = new Animal();

	test.equal( animal.getAllCmsOptions().collection, animal.getConstructorCmsOptions().collection );

	var instanceWithNoOptions = new NonSaveableConstructor();

	test.equal( instanceWithNoOptions.getAllCmsOptions(), {} );

	var instanceWithOnlyInstanceCmsOptions = new Client();

	test.equal( instanceWithOnlyInstanceCmsOptions.getAllCmsOptions(), {
		inputs: {
			clientBackground: {
				type: 'textarea'
			}
		}
	});

});

Tinytest.add('ReactiveConstructorCmsPlugin instance methods - instance.getInputType()', function(test) {
	
	var person = new Person({ rcType: 'worker' });

	test.equal( person.getInputType('title'), false );
	test.equal( person.getInputType('name'), 'textarea' );

});

Tinytest.add('ReactiveConstructorCmsPlugin instance methods - instance.getCmsOption()', function(test) {

	var person = new Person();

	test.equal( person.getCmsOption('inputs'), { name: {type: 'textarea'} });
	test.equal( person.getCmsOption('filter'), { children: ['worker', 'child'] });
	test.isFalse( person.getCmsOption('something not set') );

	test.throws(function() {
		person.getCmsOption( 123 );
	});

	test.throws(function() {
		person.getCmsOption(function() {});
	});

});

Tinytest.add('ReactiveConstructorCmsPlugin instance methods - instance.getImagePreview()', function(test) {
	
	var person = new Person({ rcType: 'worker' });

	test.equal( person.getImagePreview(), 'http://portra.wpshower.com/wp-content/uploads/2014/03/martin-schoeller-barack-obama-portrait-up-close-and-personal.jpg' );

	var animal = new Animal();

	test.isFalse( animal.getImagePreview() );

});

Tinytest.add('ReactiveConstructorCmsPlugin instance methods - instance.canBeSaved()', function(test) {

	var person = new Person();
	var nonSaveableInstance = new NonSaveableConstructor();
	
	test.isTrue( person.canBeSaved() );
	test.isFalse( nonSaveableInstance.canBeSaved() );

});

Tinytest.add('ReactiveConstructorCmsPlugin instance methods - instance.filterCreatableTypes()', function(test) {

	var testPerson = new Person({ rcType: 'husband' });
	var testAnimal = new Animal();
	var listOfPersons = [ new Person({ rcType: 'wife' }), new Person({ rcType: 'worker' }), new Person({ rcType: 'husband' })];

	// One person can be wife…
	test.equal( testPerson.filterCreatableTypes( 'wife', listOfPersons, 'rcType' ).length, 1 );
	// …two can be buddies…
	test.equal( testPerson.filterCreatableTypes( 'buddies', listOfPersons, 'rcType' ).length, 2 );
	// …and all three can be owners…
	test.equal( testAnimal.filterCreatableTypes( 'owner', listOfPersons, 'rcType' ).length, 3 );
	// …as well as the testPerson
	test.equal( testAnimal.filterCreatableTypes( 'owner', [testPerson], 'rcType' ).length, 1 );

});

Tinytest.add('ReactiveConstructorCmsPlugin instance methods - instance.unpublish(), throw error for non saveable', function(test) {

	var docToFail = new NonSaveableConstructor();

	test.throws(function() {
		docToFail.unpublish();
	});

});

Tinytest.add('ReactiveConstructorCmsPlugin constructor methods - getCreatableTypes()', function(test) {

	// Return all when no instance is passed
	test.equal( Person.getCreatableTypes().length, 4 );

	var testHusband = new Person({ rcType: 'husband' });
	// The husband type should only have one creatable type of wife
	test.equal( Person.getCreatableTypes( 'wife', testHusband ).length, 1 );

	// The husband type should only have two creatable types of buddies
	test.equal( Person.getCreatableTypes( 'buddies', testHusband ).length, 2 );

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - cleanup, remove all collections', function(test, next) {

	Meteor.call('reactive-constructor-cms/cleanup-test-db', function( err, res ) {
		if (!err){
			console.log( 'Removed: ', res, ' docs from DB.' );
			next();
		}
	});

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - not logged in method call: reactive-constructor-cms/save', function(test, next) {

	Meteor.logout(function() {
		Meteor.call('reactive-constructor-cms/save', function( err, res ) {
			test.isUndefined( res );
			test.isTrue( Match.test( err.reason, String ) );
			next();
		});
	});

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - not logged in method call: reactive-constructor-cms/delete-old-backups', function(test, next) {

	Meteor.logout(function() {
		Meteor.call('reactive-constructor-cms/delete-old-backups', function( err, res ) {
			test.isUndefined( res );
			test.isTrue( Match.test( err.reason, String ) );
			next();
		});
	});

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - not logged in method call: reactive-constructor-cms/delete', function(test, next) {

	Meteor.logout(function() {	
		Meteor.call('reactive-constructor-cms/delete', function( err, res ) {
			test.isUndefined( res );
			test.isTrue( Match.test( err.reason, String ) );
			next();
		});
	});

});


Tinytest.addAsync('ReactiveConstructorCmsPlugin async - check subscription without user', function(test, next) {

	// Make sure we're logged out
	Meteor.logout(function() {
		Meteor.subscribe('reactive-constructor-cms__editable-docs', {
			onStop: function( err ) {
				test.equal(err.errorType, 'Meteor.Error');
				next();
			}
		});
	});

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - check subscription with user', function(test, next) {
	
	loginOrCreateAccount(function() {
		return startSubscription(function() {
			next();
		});
	});

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - instance.save(), not logged in', function(test, next) {

	Meteor.logout(function() {
		test.throws(function() {
			docToSave.save({});
		});
		next();
	});

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - instance.save(), logged in', function(test, next) {

	loginOrCreateAccount(function() {
		var docToSave = new Person();
		docToSave.save({}, function( err, res ){
			test.equal( res.backupsRemoved, 0 );
			test.isTrue( Match.test( res.backup, String ) );
			test.isTrue( Match.test( res.edit, {
				insertedId: String,
				numberAffected: Number
			}));
			next();
		});
	});

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - instance.save({ publish: true })', function(test, next) {

	var docToSave = new Person();

	docToSave.save({ publish: true }, function( err, res ){

		test.equal( res.backupsRemoved, 0 );
		
		test.isTrue( Match.test( res.backup, String ) );
		
		test.equal( res.published.numberAffected, 1 );

		test.isTrue( Match.test( res.published, {
			insertedId: String,
			numberAffected: Number
		}));

		test.isTrue( Match.test( res.edit, {
			insertedId: String,
			numberAffected: Number
		}));

		next();

	});

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - instance.save(), remove backups', function(test, next) {

	// Let's first save a doc X times
	var docToSave = new Person();
	var saveTimes = 20;
	var backupsShouldBeRemovedAfter = saveTimes-15;

	var saveRecurse = function( num, instance ) {
		instance.save({ publish: true }, function( err, res ){

			test.isTrue( Match.test( res, {
				published: Object,
				edit: Object,
				backup: String,
				backupsRemoved: Number
			}));

			if (num <= backupsShouldBeRemovedAfter)
				test.equal( res.backupsRemoved, 1 );
			else
				test.equal( res.backupsRemoved, 0 );

			if (num>0)
				return saveRecurse( num-1, instance );

			return next();

		});

	};

	return saveRecurse( saveTimes, docToSave );

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - instance.arrayitemMove()', function(test, next) {
	
	var person = new Person({ rcType: 'husband', buddies: [{ name: 'mr. first' }, { name: 'john' }, {}]});
	var buddies = person.getReactiveValue('buddies');

	test.equal( buddies[1].getReactiveValue('name'), 'john');
	test.notEqual( buddies[2].getReactiveValue('name'), 'john');
	test.equal( buddies.length, 3 );

	// Move John! Now he should be at place 2 instead of 1
	person.arrayitemMove( 'buddies', 2, 1 );

	Meteor.setTimeout(function() {
		test.notEqual( buddies[1].getReactiveValue('name'), 'john');
		test.equal( buddies[2].getReactiveValue('name'), 'john');
		test.equal( buddies.length, 3 );
		test.equal( buddies[0].getReactiveValue('name'), 'mr. first');

		Meteor.setTimeout(function() {
			person.arrayitemMove( 'buddies', 0, 1 );

			test.notEqual( buddies[0].getReactiveValue('name'), 'mr. first');
			test.equal( buddies[1].getReactiveValue('name'), 'mr. first');

			test.throws(function() {
				// 'wife' is not an array, so it should throw an error
				person.arrayitemMove( 'wife', 1 );
			});

			var buddy = buddies[1];
			buddy.setReactiveValue('children', [
				new Person({ name: 'johns daughter'}),
				new Person({ name: 'johs son' })
				]);

			test.equal( buddy.getReactiveValue('children')[0].getReactiveValue('name'), 'johns daughter');
			test.notEqual( buddy.getReactiveValue('children')[1].getReactiveValue('name'), 'johns daughter');
			test.equal( buddy.getReactiveValue('children')[1].getReactiveValue('name'), 'johs son');
			test.equal( buddy.getReactiveValue('children').length, 2 );
			
			buddy.arrayitemMove('children', 0, 1);

			Meteor.setTimeout(function() {

				test.equal( buddy.getReactiveValue('children')[1].getReactiveValue('name'), 'johns daughter');
				test.equal( buddy.getReactiveValue('children')[0].getReactiveValue('name'), 'johs son');
				test.equal( buddy.getReactiveValue('children').length, 2 );

				next();

				}, 5);
			}, 5);
	}, 5);	

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - instance.unpublish(), not logged in', function(test, next) {

	var docToSave = new Person();

	Meteor.logout(function() {
		test.throws(function() {
			docToSave.save({});
		});
		next();
	});

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - instance.unpublish(), logged in', function(test, next) {

	var docToSave = new Person();

	loginOrCreateAccount(function() {
		docToSave.save({ publish: true }, function(){
			docToSave.unpublish(function( err, res ) {
				console.log( res );
				test.equal( res, 1 );
				next();
			});
		});
	});

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - instance.getPublishedDoc()', function(test, next) {

	var docToSave = new Person();

	loginOrCreateAccount(function() {
		docToSave.save({ publish: true }, function(){
			docToSave.getPublishedDoc(function( err, res ) {
				test.equal( docToSave.getType(), res.rcType );
				test.equal( docToSave.getReactiveValue('name'), res.name );
				test.equal( docToSave.getReactiveValue('title'), res.title );
				test.equal( res.reactiveConstructorCmsStatus, 'published' );
				next();
			});
		});
	});

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - instance.getPublishedDoc() and instance.unpublish()', function(test, next) {
	
	var docToSave = new Person();

	loginOrCreateAccount(function() {
		docToSave.save({ publish: true }, function(){
			docToSave.getPublishedDoc(function( err, res ) {
				test.equal( res.reactiveConstructorCmsStatus, 'published' );
				docToSave.unpublish(function( err, res ) {
					test.equal( res, 1 );
					docToSave.getPublishedDoc(function( err, res ) {
						test.isUndefined( res );
						next();
					});
				});
			});
		});
	});

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - instance.deleteInstance(), not logged in', function(test, next) {

	var docToSave = new Person();

	// First save the doc, so we know we have one
	docToSave.save({}, function(){

		Meteor.logout(function() {

			test.throws(function() {
				docToSave.deleteInstance();
			});

			next();

		});

	});

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - instance.deleteInstance(), logged in', function(test, next) {

	loginOrCreateAccount(function() {

		var docToSave = new Person();

		// First save the doc, so we know we have one
		docToSave.save({}, function(){
			docToSave.deleteInstance(function( err, res ){
				test.isTrue( Match.test( res, Number ) );
				test.isTrue( res > 0 );
				next();
			});
		});

	});

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - instance.getBackupDoc(), not logged in', function(test, next) {

	var docToFail = new Person();

	Meteor.logout(function() {
		test.throws(function() {
			docToFail.getBackupDoc();
		});
		next();
	});

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - instance.getBackupDoc(), logged in', function(test, next) {

	// This tests saves two versions of the doc, then gets two backusp (and makes sure they are fetched)
	// and then tries to get a third one which is expected to return undefined.

	loginOrCreateAccount(function() {
		var docToGetBackupsFrom = new Person();
		docToGetBackupsFrom.setReactiveValue('name', 'name v. 1');
		docToGetBackupsFrom.save({ publish: true }, function( err, res ) {
			test.equal( res.backupsRemoved, 0 );
			// Make sure the correct doc is the published one!
			docToGetBackupsFrom.getPublishedDoc(function( err, res ) {
				test.equal( res.reactiveConstructorCmsStatus, 'published' );
				test.equal( res.name, 'name v. 1' );
				docToGetBackupsFrom.setReactiveValue('name', 'name v. 2');
				docToGetBackupsFrom.save({}, function( err, res ) {
					test.equal( res.backupsRemoved, 0 );
					docToGetBackupsFrom.getBackupDoc(0, function( err, res ) {
						test.equal( res.reactiveConstructorCmsStatus, 'backup' );
						test.equal( res.name, 'name v. 2' );
						docToGetBackupsFrom.getBackupDoc(1, function( err, res ) {
							test.equal( res.reactiveConstructorCmsStatus, 'backup' );
							test.equal( res.name, 'name v. 1' );
							var backupPerson = new Person( res );
							docToGetBackupsFrom.getBackupDoc(2, function( err, res ) {
								test.isUndefined( res );
								// Save (publish!) the backup and ake sure the correct doc is the published one afterwards!
								backupPerson.save({ publish: true }, function( err, res ) {
									test.equal( res.backupsRemoved, 0 );
									// Let's use the original doc to get the published, just to make
									// sure it gets the correct one as well
									docToGetBackupsFrom.getPublishedDoc(function( err, res ) {
										test.equal( res.reactiveConstructorCmsStatus, 'published' );
										test.equal( res.name, 'name v. 1' );
										next();
									});
								});
							});
						});
					});
});
});
});
});

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - instance.getLinkableInstances()', function(test, next) {

	loginOrCreateAccount(function() {

		startSubscription(function() {

			var testPerson = new Person({ rcType: 'husband' });

			// Should throw errors if no key is passed
			test.throws(function(){
				testPerson.getLinkableInstances();
			});

			ReactiveConstructorCmsPlugin.updateGlobalInstanceStore();

			var getGlobalPersons = function() {
				return _.findWhere(ReactiveConstructorCmsPlugin.getGlobalInstanceStore(), { constructorName: 'Person' }).items;
			};

			test.notEqual( getGlobalPersons().length, 0 );

			Meteor.call('reactive-constructor-cms/cleanup-test-db', function( err ) {
				if (err)
					throw new Error('something went wrong?' + err );

				// Update the "globale instance store"
				ReactiveConstructorCmsPlugin.updateGlobalInstanceStore();
				// Check that there are now 0 persons
				test.equal( getGlobalPersons().length, 0 );

				// Let's create a person
				var testPerson = new Person({ rcType: 'husband' });

				// There should be no "wives" available
				test.equal( testPerson.getLinkableInstances( 'wife' ).length, 0 );

				// Now: let's add one wife, one worker and one husband
				var wife = new Person({ rcType: 'wife' });
				var worker = new Person({ rcType: 'worker' });
				var husband = new Person({ rcType:  'husband' });

				// Let's also add an animal just to make sure that don't affect things
				var dog = new Animal();

				dog.save({}, function() {
					wife.save({}, function() {
						worker.save({}, function() {
							husband.save({}, function() {
								// Now there should be 2 persons
								test.equal( getGlobalPersons().length, 3 );
								// And there should be one wife available
								test.equal( testPerson.getLinkableInstances( 'wife' ).length, 1 );
								// And one buddy
								test.equal( testPerson.getLinkableInstances( 'buddies' ).length, 2 );
								next();
							});
						});
					});
				});
			});
});
});

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - ReactiveConstructorCmsPlugin.getGlobalInstanceStore() / ReactiveConstructorCmsPlugin.updateGlobalInstanceStore()', function(test, next) {
	var resultOfUpdate = ReactiveConstructorCmsPlugin.updateGlobalInstanceStore();
	test.equal( resultOfUpdate, ReactiveConstructorCmsPlugin.getGlobalInstanceStore() );
	next();
});

Tinytest.addAsync('ReactiveConstructorCmsPlugin async - ReactiveConstructorCmsPlugin.getInstanceByTypeAndId()', function(test, next) {

	// Let's create a person to later look for
	var person = new Person({ rcType: 'child' });

	person.save({}, function( err, res ) {
		test.equal(
			ReactiveConstructorCmsPlugin.getInstanceByTypeAndId( 'Person', res.edit.insertedId )._id,
			person.getReactiveValue('_id')
			);
		next();
	});

});

Tinytest.addAsync('ReactiveConstructorCmsPlugin server methods - reactive-constructor-cms/get-published-doc-and-all-linked-docs', function(test, next) {

	loginOrCreateAccount(function() {

		// Setup some instances to work on
		var animal1 = new Animal({
			_id: 'pet1_id',
			name: 'Rex',
			hungry: true,
			owner: {
				type: 'reactive-constructor-cms-linked-item',
	      constructorName: 'Person',
	      _id: 'owner_id'
			}
		});
		var animal2 = new Animal({
			_id: 'pet2_id',
			name: 'Buddy doggy',
			hungry: false,
			owner: {
				type: 'reactive-constructor-cms-linked-item',
	      constructorName: 'Person',
	      _id: 'paradox_id'
			}
		});
		var animal3 = new Animal({
			_id: 'pet3_id',
			name: 'Owned by a nested BFF'
		});
		var animal4 = new Animal({
			_id: 'pet4_id',
			name: 'Owned by a super-nested BFF'
		});
		var BFF = new Person({
			_id: 'best-friend-id',
			pets: [{
				type: 'reactive-constructor-cms-linked-item',
	      constructorName: 'Animal',
	      _id: 'pet1_id'
			}],
			bestFriend: {
				bestFriend: {
					bestFriend: {
						bestFriend: {
							pets: [{
								type: 'reactive-constructor-cms-linked-item',
					      constructorName: 'Animal',
					      _id: 'pet4_id'
							}]
						}
					}
				}
			}
		});
		var owner = new Person({
			_id: 'owner_id',
			title: 'Kennel keeper',
			pets: [{
				type: 'reactive-constructor-cms-linked-item',
	      constructorName: 'Animal',
	      _id: 'pet1_id'
			}, {
				type: 'reactive-constructor-cms-linked-item',
	      constructorName: 'Animal',
	      _id: 'pet2_id'
			}],
			bestFriend: {
				title: 'Nested best friend',
				bestFriend: {
					title: 'Even nestier best friend',
					pets: [{
						type: 'reactive-constructor-cms-linked-item',
			      constructorName: 'Animal',
			      _id: 'pet3_id'
					}],
					bestFriend: {
						type: 'reactive-constructor-cms-linked-item',
			      constructorName: 'Person',
			      _id: 'best-friend-id'
					}
				}
			}
		});
		var paradoxicalOwner = new Person({
			_id: 'paradox_id',
			title: 'A paradox this is',
			bestFriend: {
				type: 'reactive-constructor-cms-linked-item',
	      constructorName: 'Person',
	      _id: 'owner_id'
			}
		});

		animal1.save({ publish: true }, function() {
			animal2.save({ publish: true }, function() {
				animal3.save({ publish: true }, function() {
					animal4.save({ publish: true }, function() {
						BFF.save({publish: true}, function() {
							paradoxicalOwner.save({publish: true}, function() {
								owner.save({ publish: true }, function() {
									Meteor.call('reactive-constructor-cms/get-published-doc-and-all-linked-docs', owner.getReactiveValue('_id'), 'Person', function( err, res ) {
										console.log( res );
										test.isTrue( Match.test( res.Person, Array ) );
										test.isTrue( Match.test( res.Animal, Array ) );
										test.equal( res.Person.length, 3 );
										test.equal( res.Animal.length, 4 );
										test.equal( _.findWhere( res.Person, { mainId: 'owner_id' }).title, 'Kennel keeper' );
										test.equal( _.findWhere( res.Person, { mainId: 'best-friend-id' }).pets[0]._id, 'pet1_id' );
										test.equal( _.findWhere( res.Animal, { mainId: 'pet2_id' }).owner._id, 'paradox_id' );
										test.equal( _.findWhere( res.Person, { mainId: 'paradox_id' }).title, 'A paradox this is' );
										test.equal( _.findWhere( res.Person, { mainId: 'paradox_id' }).bestFriend._id, 'owner_id' );

										// Also let's try to create reactive instance from these objects as well.
										_.each(res.Person, function(person){
											new Person(person);
										});
										_.each(res.Animal, function(animal){
											new Animal(animal);
										});

										next();

									});
								});
							});
						});
					});
				});
			});
		});
	});

});




