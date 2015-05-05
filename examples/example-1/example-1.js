/* global Person:true */
/* global Client:true */
/* global InvoiceListItem:true */
/* global Invoice:true */

Invoices = new Meteor.Collection('invoices');
Clients = new Meteor.Collection('clients');
Persons = new Meteor.Collection('persons');

// Create a reactive constructor which can be used in tests.
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
        sex: String,
        pets: [ Pet ]
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

Pet = new ReactiveConstructor(function Pet() {

  this.initReactiveValues( arguments[0] );

}, function() {
  return {
    typeStructure: [{
      type: 'cat',
      fields: {
        name: String
      },
      defaultData: {
        name: 'Mr. Cat-pants'
      }
    }]
  };
});

Client = new ReactiveConstructor( function Client() {

  this.initReactiveValues( arguments[0] );

}, function() {
  return {
    cmsOptions: {
      collection: Clients
    },
    typeStructure: [{
      type: 'client',
      fields: {
        clientName: String,
        adressStreet: String
      },
      defaultData: {
        clientName: 'New client'
      }
    }]
  };
});

client = new Client();

InvoiceListItem = new ReactiveConstructor(function InvoiceListItem () {

  var that = this;

  that.endPrice = function () {
    return that.getReactiveValue('units') * that.getReactiveValue('unitPrice');
  };

  that.priceAfterTax = function () {
    return that.endPrice() * (( that.getReactiveValue('tax') / 100)+1);
  };

  that.tax = function () {
    return that.priceAfterTax() - that.endPrice();
  };

  this.initReactiveValues( arguments[0] );
  
}, function() {
  return {
    typeStructure: [{
      type: 'invoiceListItem',
      fields: {
        itemName: String,
        units: Number,
        unitPrice: Number,
        unitDescription: String,
        tax: Number,
        taxDescription: String
      },
      defaultData: {
        itemName: 'Website',
        units: 35,
        unitPrice: 700,
        unitDescription: 'timmar',
        tax: 25,
        taxDescription: 'moms'
      }
    }]
  };
});

var testInvoiceListItem = new InvoiceListItem({ tax: 30 });

Invoice = new ReactiveConstructor(function Invoice () {

  var that = this;

  // Invoice items
  that.items = {};

  that.items.getTotal = function ( key ) {
    var items = that.getReactiveValue( 'items' );
    return _.reduce(items, function( memo, item ){
      if (typeof item[key] === 'function')
        return memo + item[key]();
      return memo + item[key];
    }, 0);
  };

  that.items.getTaxPercentage = function () {
    return (
      that.items.getTotal('tax') /
      that.items.getTotal('endPrice') * 100 ||
      0
      ).toFixed(1);
  };

  that.saveInvoice = function () {
    var dataToSave = that.getDataAsObject();
    return Invoices.upsert( { _id: dataToSave._id }, dataToSave );
  };

  this.initReactiveValues( arguments[0] );

}, function() {
  return {
    cmsOptions: {
      collection: Invoices
    },
    typeStructure: [{
      type: 'invoice',
      fields: {
        _id: String,
        invoiceName: String,
        currency: String,
        items: [ InvoiceListItem ],
        reference: String,
        client: Client,
        superCool: Boolean
      },
      defaultData: {
        invoiceName: 'KK000',
        superCool: false
      }
    }]
  };
});

invoice1 = new Invoice({ invoiceName: 'KK001', items: [ new InvoiceListItem() ] });

// invoice1.setReactiveValue('client', client );

person = new Person({ name: 'Stoffe K' });

person2 = new Person({ age: 17, rcType: 'child' });

person3 = new Person({ age: 50, rcType: 'child' });
// person4 = new Person();

new Person({ age: 50, rcType: 'worker', children: [{ age: 25, rcType: 'child' }] });

if (Meteor.isServer)
  return false;

Template.invoiceTestTemplate.helpers({
  person: function () {
    return person;
  },
  invoice: function () {
    return invoice1;
  },
  client: function () {
    return client;
  },
  invoices: function () {
    var constructorType = _.findWhere( tempCMSInstances.get(), { constructorName: 'Invoice' });
    if (!constructorType)
      return false;
    return constructorType.items;
  }
});

Template.invoiceTestTemplate.events({
  'click .edit-instance': function ( e ) {

    e.stopImmediatePropagation();

    ReactiveConstructorCmsPlugin.editPageGet( this );

  }
});