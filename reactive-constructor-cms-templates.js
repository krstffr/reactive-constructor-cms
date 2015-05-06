Template.editTemplate__selectOverview.events({
  'click li a': function() {
    // Make sure we have a callback function!
    var callback = Template.parentData(0).callback;
    check( callback, Function );
    // Execute the callback!
    return callback( this );
  },
  'click .reactive-constructor-cms-select-overview__fader': function() {
    var removeTemplateCallback = Template.parentData(0).removeTemplateCallback;
    check( removeTemplateCallback, Function );
    // Execute the callback!
    return removeTemplateCallback();
  }
});

Template.editTemplate__selectOverview.helpers({
  buttonValue: function() {
    if (this.reactiveConstructorCmsName)
      return this.reactiveConstructorCmsName;
    if (this.value)
      return this.value;
    throw new Error('reactive-constructor-cms', 'No button text?');
  }
});

Handlebars.registerHelper('getTemplateFromType', function () {

  if (!this.type || !this.key)
    return 'editTemplate';

  // Is it a string? Return the basic template
  if (this.type === 'String' || this.type === 'Number' || this.type === 'Date'){
    var instance = Template.parentData(1).value || Template.parentData(1);
    var userSpecifiedInput = instance.getInputType( this.key );
    if (userSpecifiedInput === 'textarea')
      return 'editTemplate__Textarea';
    return 'editTemplate__String';
  }

  // Is it a boolean?
  if (this.type === 'Boolean')
    return 'editTemplate__Boolean';

  // Is it a collection of items?
  if (this.type.search(/Collection_/g) > -1)
    return 'editTemplate__Collection';

  // no val? probably a reactive var which is not set?! TODO!
  if (!this.value)
    return 'editTemplate__noReactiveInstanceSet';

  return 'editTemplate';

});

Handlebars.registerHelper('equals', function(a, b) {
  return a === b;
});

Template.editTemplate__Collection.onRendered(function () {

  // This is the wrapper for the elements which will be sortable
  var sortableWrapper = this.find('.collection__items');

  // The most important thing of all in this sortable is the
  // return false; in the update. This prevents jQuery sortabale's
  // built in DOM change (on update), and instead does nothing
  // to the DOM on update. Instead we let Meteor/Blaze update the DOM
  // from the setReactiveValue() method!
  $( sortableWrapper ).sortable({
    // The placeholder element will get the same size as the
    // element we're moving, and it will get the built in class.
    placeholder: 'ui-state-highlight',
    forcePlaceholderSize: true,
    delay: 150,
    start: function(e, ui) {
      // Creates a temporary attribute on the element with the old index
      $(this).attr('data-previndex', ui.item.index());
    },
    update: function(e, ui) {

      // Gets the new and old index then removes the temporary attribute
      var newIndex = ui.item.index();
      var oldIndex = parseInt( $(this).attr('data-previndex'), 10 );
      $(this).removeAttr('data-previndex');

      // Get the parent context as well as this context (the array)
      var parentContext = Blaze.getData( $(this).closest('.wrap')[0] );
      var context = Blaze.getData( this );

      parentContext = parentContext.value || parentContext;

      // Update the array using the arrayitemMove method on the parent context
      parentContext.arrayitemMove( context.key, newIndex, oldIndex );

      // Super important! Return false to prevent jQuery UI from updating
      // the DOM and instead letting Meteor/Blaze do that.
      return false;

    }
  });
});

Template.editTemplate.helpers({
  isSingleInstance: function() {
    return this.key && this.value && this.type;
  },
  data: function () {

    // TODO: This should be refactored away!
    return this;

  },
  getReactiveValuesAsArray: function() {
    var instance = this.value || this;
    if (Match.test( instance.getReactiveValuesAsArray, Function ))
      return instance.getReactiveValuesAsArray();

    return _.map( instance, function( value, key ) {
      return {
        key: key,
        value: value,
        type: 'String'
      };
    });

  },
  constructorName: function () {
    var instance = this.value || this;
    if (instance.constructor.name === 'Object')
      return false;
    return instance.constructor.name;
  },
  getType: function() {
    var instance = this.value || this;
    var type = '';
    if (Match.test( instance.getType, Function ))
      type = instance.getType();
    if (instance.type)
      type = instance.type;
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
});

// TODO this is not clean at all actually.
var updateInput = function ( value, key, type, instance ) {

  if (type === 'Number')
    value = parseFloat( value, 10 ) || 0;

  instance = instance || Template.currentData().value || Template.currentData();

  if (!value)
    return instance.unsetReactiveValue( key );

  return instance.setReactiveValue( key, value );

};

Template.editTemplate__wrapper.events({
  'click .reactive-constructor-cms-close-button': function () {
    return ReactiveConstructorCmsPlugin.editPageRemove( this );
  },
  'click .reactive-constructor-cms-remove-button': function() {
    this.deleteInstance( function( res ) {
      if (res > 0)
        return ReactiveConstructorCmsPlugin.editPageRemove();
      throw new Error('reactive-constructor-cms', 'No docs removed? ' + res );
    });
  },
  'click .reactive-constructor-cms-publish-button': function () {
    return this.save({ publish: true });
  },
  'click .reactive-constructor-cms-save-draft-button': function () {
    return this.save();
  },
  'click .reactive-constructor-cms-duplicate-button': function() {
    var instance = this;
    return instance.save({ duplicate: true }, function( res ) {
      if ( res.edit ){
        var createdInstance = ReactiveConstructorCmsPlugin.getInstanceByTypeAndId( instance.constructor.name, res.edit.insertedId );
        return ReactiveConstructorCmsPlugin.editPageGet( createdInstance );
      }
    });
  }
});

Template.editTemplate__wrapper.onRendered(function() {
  $('.reactive-constructor-cms-wrapper').draggable();
});

Template.editTemplate.events({
  'click .reactive-constructor-cms-open-child-instance': function() {
    // This is not a "linked" object, but a directly nested one
    if ( Match.test( this.getReactiveValue, Function ) )
      return ReactiveConstructorCmsPlugin.editPageGet( this );
    var instance = (this.value && this.value.type === 'reactive-constructor-cms-linked-item') ? this.value : this;
    
    instance = ReactiveConstructorCmsPlugin.getInstanceByTypeAndId( instance.constructorName, instance._id );
    return ReactiveConstructorCmsPlugin.editPageGet( instance );
    // if (this.value && this.value.type)
    //   ReactiveConstructorCmsPlugin.getInstanceByTypeAndId
  },
  'click .reactive-constructor-cms-duplicate-collection-item': function ( e ) {

    e.stopImmediatePropagation();

    var listItem = $(e.currentTarget).closest('.wrap');
    var context = Blaze.getData( listItem.closest('.collection__items')[0] );
    var parentInstance = Blaze.getData( listItem.closest('.collection').closest('.wrap')[0] );

    parentInstance = parentInstance.value || parentInstance;

    parentInstance.arrayitemDuplicate( context.key, listItem.index() );

  },
  'click .reactive-constructor-cms-remove-nested-instance': function( e ) {

    e.stopImmediatePropagation();

    var instanceItem = $( e.currentTarget ).closest('.wrap');
    var parentItem = instanceItem.parent().closest('.wrap')[0];
    var parentInstance = Blaze.getData( parentItem );

    parentInstance = parentInstance.value || parentInstance;

    return parentInstance.unsetReactiveValue( this.key );

  },
  'click .reactive-constructor-cms-remove-collection-item': function ( e ) {

    e.stopImmediatePropagation();

    var listItem = $(e.currentTarget).closest('.wrap');
    var context = Blaze.getData( listItem.closest('.collection__items')[0] );
    var parentInstance = Blaze.getData( listItem.closest('.collection').closest('.wrap')[0] );

    parentInstance = parentInstance.value || parentInstance;

    parentInstance.arrayitemRemove( context.key, listItem.index() );

  },
  'click .reactive-constructor-cms-create-new-instance': function ( e ) {

    e.stopImmediatePropagation();

    var constructorName = this.type.replace(/Collection_/g, '');
    var key = this.key;
    var instance = Template.currentData().value || Template.currentData();
    var listItems = ReactiveConstructors[ constructorName ].getCreatableTypes( key, instance );

    listItems = listItems.concat( ReactiveConstructors[ constructorName ].getLinkableInstances( instance, key ) );

    return ReactiveConstructorCmsPlugin.getSelectListOverview( listItems, constructorName, key, function( newItem, instance, key ) {
      return instance.setReactiveValue( key, newItem );
    }, instance );

  },
  // Method for adding new items to a collection
  'click .reactive-constructor-cms-add-new-coll-item': function ( e ) {

    e.stopImmediatePropagation();

    var constructorName = this.type.replace(/Collection_/g, '');
    var key = this.key;
    var instance = Template.currentData().value || Template.currentData();
    var listItems = ReactiveConstructors[ constructorName ].getCreatableTypes( key, instance );

    listItems = listItems.concat( ReactiveConstructors[ constructorName ].getLinkableInstances( instance, key ) );

    return ReactiveConstructorCmsPlugin.getSelectListOverview( listItems, constructorName, key, function( newItem, instance, key ) {
      var items = instance.getReactiveValue( key );
      items.push( newItem );
      instance.setReactiveValue( key, items );
      return instance.setReactiveValue( key, items );
    }, instance );

  },
  // Method for updating the value of a property on keyup!
  'blur input, blur textarea': function( e ) {
    e.stopImmediatePropagation();
    var value = $(e.currentTarget).val();
    var instance = Template.currentData().value || Template.currentData();
    return updateInput( value, this.key, this.type, instance );
  },
  // Method for boolean values
  'change .reactive-constructor-cms-bool-select': function ( e ) {

    e.stopImmediatePropagation();
    
    var value = $(e.currentTarget).val();
    
    Template.currentData().setReactiveValue( this.key, value === 'true' );

  }
});

Template.reactiveConstructorCms__loadSavedDoc.onCreated(function() {
  this.subscribe('reactive-constructor-cms-publications', ReactiveConstructorCmsPlugin.updateGlobalInstanceStore );
});

Template.reactiveConstructorCms__loadSavedDoc.helpers({
  reactiveConstructorCms__constructors: function() {
    return ReactiveConstructorCmsPlugin.getGlobalInstanceStore();
  }
});

Template.reactiveConstructorCms__loadSavedDoc.events({
  'click .reactive-constructor-cms-edit-doc-from-list': function() {
    return ReactiveConstructorCmsPlugin.editPageGet( this );
  },
  'click .reactive-constructor-cms-create-doc-from-list': function() {

    var listItems = ReactiveConstructors[ this.constructorName ].getCreatableTypes();

    return ReactiveConstructorCmsPlugin.getSelectListOverview( listItems, this.constructorName, false, function( newItem ) {
      return ReactiveConstructorCmsPlugin.editPageGet( newItem );
    });

  }
});