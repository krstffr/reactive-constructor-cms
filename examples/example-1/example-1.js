/* global Person:true */
/* global Client:true */
/* global InvoiceListItem:true */
/* global Invoice:true */

Invoices = new Meteor.Collection('invoices');
Clients = new Meteor.Collection('clients');
Persons = new Meteor.Collection('persons');

// Create a reactive constructor which can be used in tests.
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
        sex: String,
        pets: [ Pet ]
      }
    },
    typeStructure: [{
      type: 'worker',
      fields: {
        title: String,
        bio: String
      },
      defaultData: {
        name: 'Kristoffer Klintberg',
        bio: 'Miner for 30 years…',
        title: 'Designer',
        age: 30,
        children: []
      },
      cmsOptions: {
        inputs: {
          bio: {
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

Pet = new ReactiveConstructor('Pet', function() {
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

Client = new ReactiveConstructor('Client', function() {
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

InvoiceListItem = new ReactiveConstructor('InvoiceListItem', function() {
  return {
    globalValues: {
      methods: {
        endPrice: function () {
          return this.getReactiveValue('units') * this.getReactiveValue('unitPrice');
        },
        priceAfterTax: function () {
          return this.endPrice() * (( this.getReactiveValue('tax') / 100)+1);
        },
        tax: function () {
          return this.priceAfterTax() - this.endPrice();
        }
      }
    },
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

Invoice = new ReactiveConstructor('Invoice', function() {
  return {
    globalValues: {
      methods: {
        'itemsGetTotal': function ( key ) {
          var items = this.getReactiveValue( 'items' );
          return _.reduce(items, function( memo, item ){
            if (typeof item[key] === 'function')
              return memo + item[key]();
            return memo + item[key];
          }, 0);
        },
        'itemsGetTaxPercentage': function () {
          return (
            this['itemsGetTotal']('tax') /
            this['itemsGetTotal']('endPrice') * 100 ||
            0
            ).toFixed(1);
        },
        saveInvoice: function () {
          var dataToSave = this.getDataAsObject();
          return Invoices.upsert( { _id: dataToSave._id }, dataToSave );
        }
      }
    },
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

Template.login.events({
  'click button': function() {
    Accounts.createUser({username: '1', password: '1'});
    Meteor.loginWithPassword('1', '1');
  }
});

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