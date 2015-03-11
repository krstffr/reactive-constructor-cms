/* global Person:true */
/* global Client:true */
/* global InvoiceListItem:true */
/* global Invoice:true */

Invoices = new Meteor.Collection('invoices');

if (Meteor.isServer)
  return false;

Person = new ReactiveConstructor(function Person( initData ) {

  var that = this;

  that.initData = initData || {};

  that.typeStructure = [{
    type: 'worker',
    fields: {
      name: String,
      title: String,
      children: ['self']
    }
  }, {
    type: 'child',
    fields: {
      age: Number,
      parents: ['self']
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

person = new Person({ name: 'Stoffe K' });

person2 = new Person({ age: 17, rcType: 'child' });
console.log( 'Person2 is now ' + person2.getAgePlus(0));
console.log( ' and he/she will be: ' + person2.getAgePlus( 3 ) + ' in three years!' );
console.log( 'Person2 is a teenager: ' + person2.isTeenager() );
console.log( 'Person2 ages six years and is now: ' + person2.addYears( 6 ) );
console.log( 'Person2 is a teenager after the six years? ' + person2.isTeenager() );
console.log( 'Person1 should not have a isTeenager method!');
console.log( 'typeof is: ' + typeof person.isTeenager );

person3 = new Person({ age: 50, rcType: 'child' });
person4 = new Person();

Client = new ReactiveConstructor( function Client( initData ) {

  var that = this;
  
  that.initData = initData || {};

  that.typeStructure = [{
    type: 'client',
    fields: {
      clientName: String,
      adressStreet: String,
      staff: [Person]
    }
  }];

  that.initReactiveValues();

});

client = new Client();

client.setReactiveValue('staff', [ person ] );

InvoiceListItem = new ReactiveConstructor(function InvoiceListItem ( initData ) {

  var that = this;

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
      itemName: '',
      units: 0,
      unitPrice: 700,
      unitDescription: 'timmar',
      tax: 25,
      taxDescription: 'moms'
    }
  }];

  that.endPrice = function ( context ) {
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
      items: [InvoiceListItem],
      client: Client,
      invoices: ['self'],
      // TODO: Make this work!
      childInvoice: 'self',
      superCool: Boolean
    },
    defaultData: {
      invoiceName: 'KK000',
      items: [],
      client: new Client(),
      invoices: [],
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

invoice1 = new Invoice({ invoiceName: 'KK666', items: [ new InvoiceListItem() ] });

invoice1.setReactiveValue('client', client );

invoices = new ReactiveVar( [ invoice1 ] );

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

Handlebars.registerHelper('getTemplateFromType', function () {

  if (!this.type || !this.key)
    return 'editTemplate';

  // Is it a string? Return the basic template
  if (this.type === 'String' || this.type === 'Number')
    return 'editTemplate__String';

  // Is it a boolean?
  if (this.type === 'Boolean')
    return 'editTemplate__Boolean';

  // Is it a collection of items?
  if (this.type.search(/Collection_/g) > -1)
    return 'editTemplate__Collection';

  return 'editTemplate';

});

Handlebars.registerHelper('equals', function(a, b) {
  return a === b;
});

Template.editTemplate.helpers({
  data: function () {

    // The default values should return the value of this
    if (this.type.search(/String|Number|Boolean/g) > -1)
      return this;
    
    // Collections should return the value of this
    if (this.type.search(/Collection_/g) > -1)
      return this;

    // Else the "actual value" should be returned!
    return this.value;

  },
  className: function () {
    return this.constructor.name;
  }
});

Template.invoiceTestTemplate.events({
  'click .edit-invoice': function ( e, tmpl ) {

    e.stopImmediatePropagation();

    Blaze.renderWithData( Template.editTemplate, this, document.body );

  }
});

Template.editTemplate.events({
  'click .save': function () {
    return this.saveInvoice();
  },
  // Method for adding new items to a collection
  'click .temp-add-new-coll-item': function ( e ) {

    e.stopImmediatePropagation();

    var newItem = new window[this.type.replace(/Collection_/g, '')]();

    var items = Template.currentData().getReactiveValue( this.key );
    
    items.push( newItem );

    Template.currentData().setReactiveValue( this.key, items );

  },
  // Method for updating the value of a property on keyup!
  'blur input': function ( e ) {

    e.stopImmediatePropagation();
    var value = $(e.currentTarget).val();

    if (this.type === 'Number')
      value = parseFloat( value, 10 );

    Template.currentData().setReactiveValue( this.key, value );

  },
  // Method for boolean values
  'change .TEMP-bool-select': function ( e ) {

    e.stopImmediatePropagation();
    
    var value = $(e.currentTarget).val();
    
    Template.currentData().setReactiveValue( this.key, value === 'true' );

  }
});









