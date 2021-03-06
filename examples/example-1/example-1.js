/* global Person:true */
/* global Client:true */
/* global InvoiceListItem:true */
/* global Invoice:true */

Invoices =                new Meteor.Collection('invoices');
Clients =                 new Meteor.Collection('clients');
Persons =                 new Meteor.Collection('persons');
ComplexTestConstructors = new Meteor.Collection('complexTestConstructors');

// Create a reactive constructor which can be used in tests.
Person = new ReactiveConstructor('Person', function () {
  return {
    cmsOptions: {
      collection: Persons,
      collectionPublishFilter: function () {
        return { userId: this.userId };
      },
      inputs: {
        childhoodMemories: {
          type: 'textarea'
        },
        userId: {
          disabled: true,
          initMethod: function ( value ) {
            return value || Meteor.userId() || 'no user id!';
          }
        }
      }
    },
    globalValues: {
      fields: {
        age:         Number,
        name:        String,
        children:    [ Person ],
        sex:         String,
        pets:        [ Pet ],
        portraitUrl: String,
        invoices:    [ Invoice ],
        userId:      String
      }
    },
    typeStructure: [{
      type: 'worker',
      fields: {
        title: String,
        bio: String,
        childhoodMemories: String,
        favouritePowerRanger: String
      },
      defaultData: {
        name: 'Kristoffer Klintberg',
        bio: 'Miner for 30 years…',
        title: 'Designer',
        age: 30,
        children: [],
        favouritePowerRanger: 'The red one',
        portraitUrl: 'http://portra.wpshower.com/wp-content/uploads/2014/03/martin-schoeller-barack-obama-portrait-up-close-and-personal.jpg'
      },
      cmsOptions: {
        imgPreviewKey: 'portraitUrl',
        inputs: {
          title: {
            type: 'select',
            selectValues: function() {
              return [{
                value: 'Designer(THE_VALUE)',
                displayValue: 'Designer (only for display)'
              }, {
                value: 'Developer'
              }, {
                value: 'President',
                displayValue: 'President DISPLAY'
              }, {
                value: 'Tsar'
              }];
            }
          },
          bio: {
            type: 'textarea'
          },
          favouritePowerRanger: {
            disabled: true,
            selectValues: function() {
              return [{
                value: 'The red one',
                getImagePreview: 'https://fbcdn-profile-a.akamaihd.net/hprofile-ak-xpf1/v/t1.0-1/c0.50.200.200/998152_10152626980993012_686571052_n.jpg?oh=1ffcad1d1d8b1e1d82c42ffa3291750d&oe=55C24D4F&__gda__=1442442878_fc69edf002edfafcd7f12a8a164d0a18'
              }, {
                value: 'The green one',
                getImagePreview: 'http://upload.wikimedia.org/wikipedia/en/9/95/GreenRanger.jpg'
              }, {
                value: 'Gold',
                getImagePreview: 'http://nick.mtvnimages.com/nick-assets/video/images/power-rangers/power-rangers-samurai-111-unexpected-arrival-gold-ranger-clip.jpg?format=jpeg&matteColor=white'
              }];
            },
            selectOverview: true
          },
          portraitUrl: {
            previewImage: true,
            transform: function( value ) {
              return value.replace(/ /g, '');
            }
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
        name: String,
        cool: Boolean,
        bestPetPal: Pet
      },
      defaultData: {
        name: 'Mr. Cat-pants',
        cool: true
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
        adressStreet: String,
        clientLogo: String
      },
      defaultData: {
        clientName: 'New client',
        clientLogo: 'http://www.pubologi.se/img/pubologi-logo--circle.png'
      },
      cmsOptions: {
        imgPreviewKey: 'clientLogo'
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
        _id:         String,
        invoiceName: String,
        currency:    String,
        items:       [ InvoiceListItem ],
        reference:   String,
        client:      Client,
        superCool:   Boolean,
        userId:      String
      },
      defaultData: {
        invoiceName: 'KK000',
        superCool: false
      },
      cmsOptions: {
        inputs: {
          userId: {
            initMethod: function( value ) {
              return value || Meteor.userId();
            }
          }
        }
      }
    }]
  };
});

ComplexTestConstructor = new ReactiveConstructor('ComplexTestConstructor', function() {
  return {
    cmsOptions: {
      collection: ComplexTestConstructors,
      filter: {
        manChild: ['worker']
      }
    },
    typeStructure: [{
      type: 'Complex instance',
      fields: {
        name: String,
        children: [ ComplexTestConstructor ],
        manChild: Person
      },
      cmsOptions: {

      }
    }]
  };
});

if (Meteor.isServer){

  Invoices._ensureIndex({ reactiveConstructorCmsStatus: 1 });
  Clients._ensureIndex({ reactiveConstructorCmsStatus: 1 });
  Persons._ensureIndex({ reactiveConstructorCmsStatus: 1 });
  ComplexTestConstructors._ensureIndex({ reactiveConstructorCmsStatus: 1 });

  Meteor.publish('testPublication', function( mainId, constructorName ) {
    return reactiveConstructorCmsGetPublishCursorFromDoc( getCollectionFromConstructorName( constructorName ).findOne( mainId ), constructorName );
  });

  return false;
}

// Just log in already
Meteor.startup(function() {
  if (!Meteor.userId()){
    Accounts.createUser({ username: 'Kristoffer', password: 'Klintan1?'});
    Meteor.loginWithPassword('Kristoffer', 'Klintan1?');
    Meteor.setTimeout(function() {
      location.reload();
    }, 1000 );
  }
});

person = new Person({ name: 'Stoffe K' });

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
  invoices: function () {
    return Invoices.find({}, {
      transform: function( doc ) { return new Invoice( doc ); }
    });
  }
});

Template.invoiceTestTemplate.events({
  'click .edit-instance': function ( e ) {

    e.stopImmediatePropagation();

    ReactiveConstructorCmsPlugin.editPageGet({ instance: this });

  }
});
