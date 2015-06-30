// Templates and methods relating to the getReactiveValueEditable functionality

/* ----- */

Template.editTemplate__elementTextareaOverlay.onRendered(function(){

  // Get the original element and the newly rendered element
  var originalElement = $( this.data.originalElement );
  var editElement = $( this.firstNode );

  // Make sure there is one of each, else throw error
  if ( originalElement.length !== 1 || editElement.length !== 1)
    throw new Meteor.Error('reactive-constructor-cms', 'DOM error'); 

  // Set the size of the edit element to match the original element.
  return editElement.css({
    top: originalElement.offset().top,
    left: originalElement.offset().left,
    height: originalElement.height(),
    width: originalElement.width(),
    position: 'absolute'
  }).addClass('edit-overlay--visible');

});

// Holder for the edit template which will be overlayed over the
// element which gets edited.
var reactiveValueEditTemplate = false;

var removereactiveValueEditTemplate = function () {
  // If there is no current edit template, do nothing.
  if (!reactiveValueEditTemplate)
    return false;
  // Remove the template and reset the template var
  // to false.
  Blaze.remove( reactiveValueEditTemplate );
  reactiveValueEditTemplate = false;
  return true;
};

Template.editTemplate__elementTextareaOverlay.events({
  'click .edit-overlay__button--cancel': function() {
    // Remove the edit template.
    return removereactiveValueEditTemplate();
  },
  'click .edit-overlay__button--save': function ( e ) {

    // Get the new value…
    var value = $(e.currentTarget).parent().find('textarea').val();

    // …set it using typecasting…
    this.instance.setReactiveValueWithTypecasting( this.key, value );

    // …remove the edit template.
    return removereactiveValueEditTemplate();

  }
});

Template.getReactiveValueEditable.events({
  'click .cms-edit': function ( e ) {

    if (!Meteor.userId || !Meteor.userId())
      return ;

    // Make sure the right types are set
    check( this.instance.rcType, String );
    check( this.key, String );
    if (this.toMarkdown)
      check( this.toMarkdown, Boolean );

    // Remove the current template
    removereactiveValueEditTemplate();

    // Add a new template
    reactiveValueEditTemplate = Blaze.renderWithData(
      Template.editTemplate__elementTextareaOverlay,
      {
        instance: this.instance,
        key: this.key,
        toMarkdown: this.toMarkdown,
        originalElement: e.currentTarget
      },
      $('body')[0]
      );

    return true;

  }
});