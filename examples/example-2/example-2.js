SomeStructure = new ReactiveConstructor('SomeStructure', function() {
  return {
    typeStructure: [{
      type: 'something',
      fields: {
        aString: String,
        aNumber: Number,
        aBool:   Boolean
      }
    }]
  };
});

if (!Meteor.isClient)
  return false;

Template['tempEditOverlay'].onRendered(function(argument){

  var originalElement = $( this.data.originalElement );
  var editElement = $( this.firstNode );

  return editElement.css({
    top: originalElement.offset().top,
    left: originalElement.offset().left,
    height: originalElement.height(),
    width: originalElement.width(),
    position: 'absolute'
  }).addClass('edit-overlay--visible');

});

structure = new SomeStructure({
  rcType: 'something',
  aString: '# StringaLing\n\nNew paragraph?',
  aNumber: 4530,
  aBool: true
});

Template.testTemplate.helpers({
  aTest: function() {
    return structure;
  }
});

Blaze.registerHelper('editableReactiveValue', function( options ) {

  var key = options.hash.key;
  var markdown = options.hash.markdown || false;

  check( key, String );
  check( markdown, Boolean );

  if (!Meteor.userId || !Meteor.userId())
    return value;

  return Blaze.toHTMLWithData( Template['tempContentClickable'], {
    instance: this,
    key: key,
    markdown: markdown
  });

});

var renderedEditTemplate = false;

var removeRenderedEditTemplate = function () {
  if (renderedEditTemplate) {
    Blaze.remove( renderedEditTemplate );
    renderedEditTemplate = false;
  }
  return true;
};

Template.tempEditOverlay.events({
  'click .edit-overlay__button--cancel': function() {
    return removeRenderedEditTemplate();
  },
  'click .edit-overlay__button--save': function ( e ) {

    var value = $(e.currentTarget).parent().find('textarea').val();

    this.instance.setReactiveValueWithTypecasting( this.key, value );

    return removeRenderedEditTemplate();

  }
});

Template.body.events({
  // Just an event for loggin in/out
  'click #login': function() {

    if (Meteor.userId && Meteor.userId())
      return Meteor.logout();

    return Accounts.createUser({ username: '11', password: '11!' }, function(err){
      if (err)
        return Meteor.loginWithPassword('11', '11!', function( err ){
          console.log( err );
        });
    });

  }
});

Template.tempContentClickable.events({
  'click .cms-edit': function ( e ) {

    if (!Meteor.userId && !Meteor.userId())
      return false;

    removeRenderedEditTemplate();

    renderedEditTemplate = Blaze.renderWithData(
      Template['tempEditOverlay'],
      {
        instance: this.instance,
        key: this.key,
        originalElement: e.currentTarget
      },
      $('body')[0]
      );

  }
});
