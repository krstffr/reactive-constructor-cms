SomeStructure = new ReactiveConstructor('SomeStructure', function() {
  return {
    typeStructure: [{
      type: 'something',
      fields: {
        aString: String,
        aNumber: Number
      }
    }]
  };
});

if (!Meteor.isClient)
  return false;

document.execCommand('formatBlock', false, 'p');

structure = new SomeStructure({ rcType: 'something', aString: '# StringaLing\n\nNew paragraph?' });

Template.testTemplate.helpers({
  aTest: function() {
    return structure;
  },
  session: function( key ) {
    return Session.get(key);
  }
});

Blaze.registerHelper('editableReactiveValue', function( key, options ) {

  var value = this.getReactiveValue( key );

  var wrapper = 'textarea';

  if ( !Session.equals('rcms-editing', key) )
    wrapper = 'span';

  if (options.hash.markdown && !Session.equals('rcms-editing', key) ){
    var converter = new Showdown.converter();
    console.log( converter );
    value = converter.makeHtml( value );
  }

  if (!Meteor.userId || !Meteor.userId())
    return value;  

  return '<'+wrapper+' data-rcms-key="' + key + '" class="cms-edit" contenteditable >' + value + '</'+wrapper+'>';

});

Template.body.events({
  'click #login': function() {
    Accounts.createUser({ username: '11', password: '11!' });
    Meteor.loginWithPassword('11', '11');
  },
  'focus .cms-edit, click .cms-edit': function( e ) {
    var key = $(e.currentTarget).data('rcms-key');
    console.log( key );
    return Session.set('rcms-editing', key );
  },
  'blur .cms-edit': function( e ) {

    Session.set('rcms-editing', false );

    var key = $(e.currentTarget).data('rcms-key');
    var value = $(e.currentTarget).val() || $(e.currentTarget).html();

    console.log( 'value, pre line break replace', value );

    // Change line breaks into newlines
    value = value.replace(/<br>/g, '\n');
    console.log( 'saving:', value );

    // Set numbers to numbers
    if( this.getReactiveValue(key).constructor === Number )
      value = parseFloat( value, 10 );

    return this.setReactiveValue( key, value );

  }
});