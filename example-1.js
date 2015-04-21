/* global Person:true */
/* global Client:true */
/* global InvoiceListItem:true */
/* global Invoice:true */

Invoices = new Meteor.Collection('invoices');

if (Meteor.isServer)
  return false;

// Create a reactive constructor which can be used in tests.
Person = new ReactiveConstructor(function Person( initData ) {

  var that = this;

  that.initData = initData || {};

  that.globalValues = {
    fields: {
      age: Number,
      name: String,
      children: [ Person ],
      parents: [ Person ],
      sex: String
    }
  };

  that.typeStructure = [{
    type: 'worker',
    fields: {
      title: String
    },
    defaultData: {
      name: 'Kristoffer Klintberg',
      title: 'Designer',
      age: 30,
      children: []
    }
  }, {
    type: 'husband',
    fields: {
      wife: Person,
      sex: 'male'
    },
    defaultData: {
      age: 49
    }
  }, {
    type: 'wife',
    fields: {
      happy: Boolean
    },
    defaultData: {
      age: 54,
      sex: 'female'
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
  }];

  that.initReactiveValues();

});

Client = new ReactiveConstructor( function Client( initData ) {

  var that = this;
  
  that.initData = initData || {};

  that.typeStructure = [{
    type: 'client',
    fields: {
      clientName: String,
      adressStreet: String,
      // staff: [ Person ],
      // mainClient: Client
      // otherClients: [ Client ]
    }
  }];

  that.initReactiveValues();

});

client = new Client();

// client.setReactiveValue('mainClient', new Client() );

// client.setReactiveValue('staff', [ person ] );

InvoiceListItem = new ReactiveConstructor(function InvoiceListItem ( initData ) {

  var that = this;

  that.initData = initData;

  that.typeStructure = [{
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
  }];

  that.endPrice = function () {
    return that.getReactiveValue('units') * that.getReactiveValue('unitPrice');
  };

  that.priceAfterTax = function () {
    return that.endPrice() * (( that.getReactiveValue('tax') / 100)+1);
  };

  that.tax = function () {
    return that.priceAfterTax() - that.endPrice();
  };

  that.initReactiveValues();
  
});

var testInvoiceListItem = new InvoiceListItem({ tax: 30 });

Invoice = new ReactiveConstructor(function Invoice ( initData ) {

  var that = this;

  that.initData = initData;

  that.typeStructure = [{
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
  }];

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

  that.initReactiveValues();

});

invoice1 = new Invoice({ invoiceName: 'KK001', items: [ new InvoiceListItem() ] });

// invoice1.setReactiveValue('client', client );

invoices = new ReactiveVar( [ invoice1 ] );

person = new Person({ name: 'Stoffe K' });

person2 = new Person({ age: 17, rcType: 'child' });

person3 = new Person({ age: 50, rcType: 'child' });
// person4 = new Person();

new Person({ age: 50, rcType: 'worker', children: [{ age: 25, rcType: 'child' }] });

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
    return invoices.get();
  }
});

Template.invoiceTestTemplate.events({
  'click .edit-instance': function ( e ) {

    e.stopImmediatePropagation();

    this.editPageGet();

  }
});