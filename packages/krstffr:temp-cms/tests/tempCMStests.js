Persons = new Meteor.Collection('persons');

Meteor.startup(function() {

	Person = new ReactiveConstructor(function Person() {

		this.initReactiveValues( arguments[0] );

	}, function () {
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
					title: String
				},
				defaultData: {
					name: 'Kristoffer Klintberg',
					title: 'Designer',
					age: 30,
					children: []
				},
				cmsOptions: {
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

	NonSaveableConstructor = new ReactiveConstructor(function NonSaveableConstructor() {

		this.initReactiveValues( arguments[0] );

	}, function() {
		return {
			typeStructure: [{
				type: 'this is a non saveable instance'
			}]
		};
	});

});

if (Meteor.isServer){
	Meteor.methods({
		'tempcms-test/cleanup-test-db': function() {
			console.log('removing all persons from DB…');
			return Persons.remove({});
		}
	});
	return false;
}

Tinytest.add('TEMPcmsPlugin - init: main object and all methods exists', function(test) {

	test.isTrue( Match.test( TEMPcmsPlugin, ReactiveConstructorPlugin ) );

	test.isTrue( Match.test( TEMPcmsPlugin.checkReactiveValueType, Function ) );
	test.isTrue( Match.test( TEMPcmsPlugin.checkReactiveValues, Function ) );
	test.isTrue( Match.test( TEMPcmsPlugin.setValueToCorrectType, Function ) );
	test.isTrue( Match.test( TEMPcmsPlugin.getSelectListOverview, Function ) );
	test.isTrue( Match.test( TEMPcmsPlugin.getInstanceByTypeAndId, Function ) );
	test.isTrue( Match.test( TEMPcmsPlugin.getGlobalInstanceStore, Function ) );
	test.isTrue( Match.test( TEMPcmsPlugin.updateGlobalInstanceStore, Function ) );
	test.isTrue( Match.test( TEMPcmsPlugin.editPageRemove, Function ) );
	test.isTrue( Match.test( TEMPcmsPlugin.editPageGet, Function ) );

});

Tinytest.add('TEMPcmsPlugin overrides - checkReactiveValueType()', function(test) {

	var incorrectLinkObject = {type: 'TEMPCMS-linked-item', constructorName: Person, _id: 456 };
	var correctLinkObject = {type: 'TEMPCMS-linked-item', constructorName: 'Person', _id: 'a proper id' };

	// Should fail if not passing correct arguments
	test.throws(function () {
		TEMPcmsPlugin.checkReactiveValueType();
	});
	test.throws(function () {
		TEMPcmsPlugin.checkReactiveValueType('firstVal');
	});
	test.throws(function () {
		TEMPcmsPlugin.checkReactiveValueType('firstVal', Object);
	});
	test.throws(function () {
		TEMPcmsPlugin.checkReactiveValueType('firstVal', Object, 'Wrong type');
	});
	test.throws(function() {
		TEMPcmsPlugin.checkReactiveValueType(incorrectLinkObject, 'shit', function() {});
	});

	// Passing a proper linked object should return true
	test.isTrue( TEMPcmsPlugin.checkReactiveValueType(correctLinkObject, 'shit', function() {}) );

	// Passing an array with a linked object should pass an empty array to the default method
	TEMPcmsPlugin.checkReactiveValueType([ correctLinkObject ], 'shit', function( passedValue ) {
		test.equal(passedValue, []);
	});

	// Passing an array with an "ordinary" constructor should pass an array with the constructor
	 // to the default method
	 TEMPcmsPlugin.checkReactiveValueType([ Person ], 'shit', function( passedValue ) {
	 	test.equal(passedValue, [Person]);
	 });

	});

Tinytest.add('TEMPcmsPlugin overrides - checkReactiveValues()', function(test) {

	// Should fail if not passing correct arguments
	test.throws(function () {
		TEMPcmsPlugin.checkReactiveValues();
	});
	test.throws(function () {
		TEMPcmsPlugin.checkReactiveValues('firstVal');
	});
	test.throws(function () {
		TEMPcmsPlugin.checkReactiveValues('firstVal', Object);
	});
	test.throws(function () {
		TEMPcmsPlugin.checkReactiveValues('firstVal', Object, 'Wrong type');
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

	TEMPcmsPlugin.checkReactiveValues( ordinaryInstance, ordinaryStructure, function( dataToCheck, currentTypeStructure ) {
		test.equal( ordinaryInstance, dataToCheck );
		test.equal( ordinaryStructure, currentTypeStructure );
	});

	var correctLinkObject = {type: 'TEMPCMS-linked-item', constructorName: 'Person', _id: 'a proper id' };
	var linkInstance = {
		persons: [ correctLinkObject ],
		wife: correctLinkObject,
		something: 'hej'
	};

	TEMPcmsPlugin.checkReactiveValues( linkInstance, ordinaryStructure, function( dataToCheck, currentTypeStructure ) {
		test.equal( dataToCheck.persons, [] );
		test.isUndefined( dataToCheck.wife );
		test.equal( ordinaryStructure, currentTypeStructure );
	});

});

Tinytest.add('TEMPcmsPlugin overrides - setValueToCorrectType', function(test) {

	// Not passing the correct arguments should throw errors
	test.throws(function() {
		TEMPcmsPlugin.setValueToCorrectType();
	});
	test.throws(function() {
		TEMPcmsPlugin.setValueToCorrectType(1,2,3,'not a function');
	});

	// Make sure correct values are passed through the way they should
	var instance = new Person({ rcType: 'husband' });
	var wifeObject = { rcType: 'wife '};
	TEMPcmsPlugin.setValueToCorrectType(instance, wifeObject, 'wife', function( passedInstance, value, key ) {
		test.equal( value, wifeObject );
		test.equal( key, 'wife' );
		test.equal( passedInstance, instance );
	});

	// Make sure a linked value is passed through the way it should
	var linkedWife = { type: 'TEMPCMS-linked-item', constructorName: 'Person', _id: 'a proper id' };
	TEMPcmsPlugin.setValueToCorrectType(instance, linkedWife, 'wife', function( passedInstance, value, key ) {
		test.equal( value, linkedWife );
		test.equal( key, 'wife' );
		test.equal( passedInstance, instance );
	});

	// Make sure an array of both linked and "ordinary" values are passed through the way it should
	var buddies = [ { rcType: 'husband' }, linkedWife ];
	TEMPcmsPlugin.setValueToCorrectType(instance, buddies, 'buddies', function( passedInstance, value, key ) {
		test.equal( value, buddies );
		test.equal( key, 'buddies' );
		test.equal( passedInstance, instance );
	});

});

Tinytest.add('TEMPcmsPlugin instance methods - getCollection', function(test) {

	var testPerson = new Person();

	test.isTrue( Match.test( testPerson.getCollection(), Mongo.Collection ) );
	test.equal( testPerson.getCollection(), Persons );

	var docWithNoCollection = new NonSaveableConstructor();
	test.isFalse( docWithNoCollection.getCollection() );

});

Tinytest.add('TEMPcmsPlugin instance methods - instance.save(), throw error for non saveable', function(test) {

	var docToFail = new NonSaveableConstructor();

	test.throws(function() {
		docToFail.save();
	});

});

Tinytest.add('TEMPcmsPlugin instance methods - instance.deleteInstance(), throw error for non saveable', function(test) {

	var docToFail = new NonSaveableConstructor();

	test.throws(function() {
		docToFail.deleteInstance();
	});

});

Tinytest.add('TEMPcmsPlugin instance methods - instance.arrayitemDuplicate()', function(test) {
	
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

Tinytest.add('TEMPcmsPlugin instance methods - instance.arrayitemMove()', function(test) {
	
	var person = new Person({ rcType: 'husband', buddies: [{}, { name: 'john' }, {}]});
	var buddies = person.getReactiveValue('buddies');

	test.equal( buddies[1].getReactiveValue('name'), 'john');
	test.notEqual( buddies[2].getReactiveValue('name'), 'john');
	test.equal( buddies.length, 3 );

	// Move John! Now he should be at place 2 instead of 1
	person.arrayitemMove( 'buddies', 2, 1 );

	test.notEqual( buddies[1].getReactiveValue('name'), 'john');
	test.equal( buddies[2].getReactiveValue('name'), 'john');
	test.equal( buddies.length, 3 );

	test.throws(function() {
		// 'wife' is not an array, so it should throw an error
		person.arrayitemMove( 'wife', 1 );
	});

});

Tinytest.add('TEMPcmsPlugin instance methods - instance.arrayitemRemove()', function(test) {
	
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

Tinytest.add('TEMPcmsPlugin instance methods - instance.getReactiveValuesAsArray()', function(test) {
	
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

Tinytest.add('TEMPcmsPlugin instance methods - instance.getInstanceCmsOptions()', function(test) {
	
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

Tinytest.add('TEMPcmsPlugin constructor methods - getCreatableTypes()', function(test) {

	// Return all when no instance is passed
	test.equal( Person.getCreatableTypes().length, 4 );

	var testHusband = new Person({ rcType: 'husband' });
	// The husband type should only have one creatable type of wife
	test.equal( Person.getCreatableTypes( 'wife', testHusband ).length, 1 );

	// The husband type should only have two creatable types of buddies
	test.equal( Person.getCreatableTypes( 'buddies', testHusband ).length, 2 );

});

Tinytest.addAsync('TEMPcmsPlugin async - cleanup, remove all collections', function(test, next) {

	Meteor.call('tempcms-test/cleanup-test-db', function(err, res) {
		if (!err){
			console.log( 'Removed: ', res, ' docs from DB.' );
			next();
		}
	});

});

Tinytest.addAsync('TEMPcmsPlugin async - check subscription', function(test, next) {
	Meteor.subscribe('temp-cms-publications', {
		onReady: function() {
			next();
		}
	});
});

Tinytest.addAsync('TEMPcmsPlugin async - instance.save()', function(test, next) {

	var docToSave = new Person();
	docToSave.save({}, function(res){
		test.equal( res.backupsRemoved, 0 );
		test.isTrue( Match.test( res.backup, String ) );
		test.isTrue( Match.test( res.edit, {
			insertedId: String,
			numberAffected: Number
		}));
		next();
	});

});

Tinytest.addAsync('TEMPcmsPlugin async - instance.save({ publish: true })', function(test, next) {

	var docToSave = new Person();

	docToSave.save({ publish: true }, function(res){

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

Tinytest.addAsync('TEMPcmsPlugin async - instance.save(), remove backups', function(test, next) {

	// Let's first save a doc X times
	var docToSave = new Person();
	var saveTimes = 20;
	var backupsShouldBeRemovedAfter = saveTimes-15;

	var saveRecurse = function( num, instance ) {
		instance.save({ publish: true }, function( res ){

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

Tinytest.addAsync('TEMPcmsPlugin async - instance.deleteInstance()', function(test, next) {

	var docToSave = new Person();

	// First save the doc, so we know we have one
	docToSave.save({}, function(){
		docToSave.deleteInstance(function(res){
			test.isTrue( Match.test( res, Number ) );
			test.isTrue( res > 0 );
			next();
		});
	});

});

Tinytest.addAsync('TEMPcmsPlugin async - Person.getLinkableInstances()', function(test, next) {
	
	// Should throw errors if no instance or key is passed
	test.throws(function(){
		Person.getLinkableInstances();
	});
	test.throws(function(){
		Person.getLinkableInstances( new Person() );
	});

	var getGlobalPersons = function() {
		return _.findWhere(TEMPcmsPlugin.getGlobalInstanceStore(), { constructorName: 'Person' }).items;
	};

	test.notEqual( getGlobalPersons().length, 0 );

	Meteor.call('tempcms-test/cleanup-test-db', function( err ) {
		if (err)
			throw new Error('something went wrong?' + err );

		// Update the "globale instance store"
		TEMPcmsPlugin.updateGlobalInstanceStore();
		// Check that there are now 0 persons
		test.equal( getGlobalPersons().length, 0 );

		// Let's create a person
		var testPerson = new Person({ rcType: 'husband' });

		// There should be no "wives" available
		test.equal( Person.getLinkableInstances( testPerson, 'wife' ).length, 0 );

		// Now: let's add one wife and one worker
		var wife = new Person({ rcType: 'wife' });
		var worker = new Person({ rcType: 'worker' });

		wife.save({}, function() {
			worker.save({}, function() {
				// Now there should be 2 persons
				test.equal( getGlobalPersons().length, 2 );
				// And there should be one wife available
				test.equal( Person.getLinkableInstances( testPerson, 'wife' ).length, 1 );
				// And one buddy
				test.equal( Person.getLinkableInstances( testPerson, 'buddies' ).length, 1 );
				next();
			});
		});

	});

});

Tinytest.addAsync('TEMPcmsPlugin async - TEMPcmsPlugin.getGlobalInstanceStore() / TEMPcmsPlugin.updateGlobalInstanceStore()', function(test, next) {
	var resultOfUpdate = TEMPcmsPlugin.updateGlobalInstanceStore();
	test.equal( resultOfUpdate, TEMPcmsPlugin.getGlobalInstanceStore() );
	next();
});

Tinytest.addAsync('TEMPcmsPlugin async - TEMPcmsPlugin.getInstanceByTypeAndId()', function(test, next) {

	// Let's create a person to later look for
	var person = new Person({ rcType: 'child' });

	person.save({}, function(res) {
		test.equal(
			TEMPcmsPlugin.getInstanceByTypeAndId( 'Person', res.edit.insertedId ).getReactiveValue('_id'),
			person.getReactiveValue('_id')
			);
		next();
	});

});






