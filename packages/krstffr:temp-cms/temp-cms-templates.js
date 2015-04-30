Template.editTemplate__selectOverview.events({
  'click button': function() {
    // Make sure we have a callback function!
    var callback = Template.parentData(0).callback;
    check( callback, Function );
    // Execute the callback!
    return callback( this );
  },
  'click .temp-select-overview__fader': function() {
    var removeTemplateCallback = Template.parentData(0).removeTemplateCallback;
    check( removeTemplateCallback, Function );
    // Execute the callback!
    return removeTemplateCallback();
  }
});

Template.editTemplate__selectOverview.helpers({
  buttonValue: function() {
    if (this.tempCmsName)
      return this.tempCmsName;
    if (this.value)
      return this.value;
    throw new Error('temp-cms', 'No button text?');
  }
});

Handlebars.registerHelper('getTemplateFromType', function () {

  if (!this.type || !this.key)
    return 'editTemplate';

  // Is it a string? Return the basic template
  if (this.type === 'String' || this.type === 'Number' || this.type === 'Date')
    return 'editTemplate__String';

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

Template.editTemplate__Collection.rendered = function () {

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
      // TODO: This is no longer needed as they SHOULD both be the same!!
      // return false;

    }
  });
};

Template.editTemplate__Collection.helpers({
  listItemData: function() {
    return _.assign( this, { isListItem: true });
  }
});

Template.editTemplate.helpers({
  isSingleInstance: function() {
    return this.key && this.value && this.type;
  },
  data: function () {

    return this;

    // The default values should return the value of this
    if (this.type.search(/String|Number|Boolean/g) > -1)
      return this;
    
    // Collections should return the value of this
    if (this.type.search(/Collection_/g) > -1)
      return this;

    // If there is a getReactiveValue function, it is very
    // probable that it is a reactive instance
    if ( this.value && Match.test( this.value.getReactiveValue, Function ) )
      return this;

    // If there is no value set, it's probably (TODO!??)
    // a reactive instance which is not yet set!
    if (this.key && this.type)
      return this;

    // Else the "actual value" should be returned!
    return this.value;

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
var handleBlurEvent = function ( e ) {

  e.stopImmediatePropagation();

  var value = $(e.currentTarget).val();

  if (this.type === 'Number')
    value = parseFloat( value, 10 );

  // This is for handling template which have a data context of "key", "value"
  // and "type"
  if (Template.currentData().value)
    return Template.currentData().value.setReactiveValue( this.key, value );

  return Template.currentData().setReactiveValue( this.key, value );

};

Template.editTemplate__wrapper.events({
  'click .temp-cms-close-button': function () {
    return TEMPcmsPlugin.editPageRemove( this );
  },
  'click .temp-cms-remove-button': function() {
    this.deleteInstance( function( res ) {
      if (res > 0)
        return TEMPcmsPlugin.editPageRemove();
      throw new Error('temp-cms', 'No docs removed? ' + res );
    });
  },
  'click .temp-cms-publish-button': function () {
    return this.save({ publish: true });
  },
  'click .temp-cms-save-draft-button': function () {
    return this.save();
  },
  'click .temp-cms-duplicate-button': function() {
    var instance = this;
    return instance.save({ duplicate: true }, function( res ) {
      if ( res.edit ){
        var createdInstance = TEMPcmsPlugin.getInstanceByTypeAndId( instance.constructor.name, res.edit.insertedId );
        return TEMPcmsPlugin.editPageGet( createdInstance );
      }
    });
  }
});

Template.editTemplate.events({
  'click .temp-remove-collection-duplicate': function ( e ) {

    e.stopImmediatePropagation();

    var listItem = $(e.currentTarget).closest('.wrap');
    var context = Blaze.getData( listItem.closest('.collection__items')[0] );
    var parentInstance = Blaze.getData( listItem.closest('.collection').closest('.wrap')[0] );

    parentInstance = parentInstance.value || parentInstance;

    parentInstance.arrayitemDuplicate( context.key, listItem.index() );

  },
  'click .temp-remove-nested-rc-instance': function( e ) {

    e.stopImmediatePropagation();

    var instanceItem = $( e.currentTarget ).closest('.wrap');
    var parentItem = instanceItem.parent().closest('.wrap')[0];
    var parentInstance = Blaze.getData( parentItem );

    console.log( this );

    parentInstance = parentInstance.value || parentInstance;

    return parentInstance.unsetReactiveValue( this.key );

  },
  'click .temp-remove-collection-item': function ( e ) {

    e.stopImmediatePropagation();

    var listItem = $(e.currentTarget).closest('.wrap');
    var context = Blaze.getData( listItem.closest('.collection__items')[0] );
    var parentInstance = Blaze.getData( listItem.closest('.collection').closest('.wrap')[0] );

    parentInstance = parentInstance.value || parentInstance;

    parentInstance.arrayitemRemove( context.key, listItem.index() );

  },
  'click .temp-cms-create-new-instance': function ( e ) {

    e.stopImmediatePropagation();

    var constructorName = this.type.replace(/Collection_/g, '');
    var key = this.key;
    var instance = Template.currentData().value || Template.currentData();
    var listItems = ReactiveConstructors[ constructorName ].getCreatableTypes( key, instance );

    listItems = listItems.concat( ReactiveConstructors[ constructorName ].getLinkableInstances( instance, key ) );

    return TEMPcmsPlugin.getSelectListOverview( listItems, constructorName, key, function( newItem, instance, key ) {
      return instance.setReactiveValue( key, newItem );
    }, instance );

  },
  // Method for adding new items to a collection
  'click .temp-add-new-coll-item': function ( e ) {

    e.stopImmediatePropagation();

    var constructorName = this.type.replace(/Collection_/g, '');
    var key = this.key;
    var instance = Template.currentData().value || Template.currentData();
    var listItems = ReactiveConstructors[ constructorName ].getCreatableTypes( key, instance );

    listItems = listItems.concat( ReactiveConstructors[ constructorName ].getLinkableInstances( instance, key ) );

    return TEMPcmsPlugin.getSelectListOverview( listItems, constructorName, key, function( newItem, instance, key ) {
      var items = instance.getReactiveValue( key );
      items.push( newItem );
      instance.setReactiveValue( key, items );
      return instance.setReactiveValue( key, items );
    }, instance );

  },
  // Method for updating the value of a property on keyup!
  'blur input': handleBlurEvent,
  // Method for boolean values
  'change .TEMP-bool-select': function ( e ) {

    e.stopImmediatePropagation();
    
    var value = $(e.currentTarget).val();
    
    Template.currentData().setReactiveValue( this.key, value === 'true' );

  }
});

Template.tempCMS__loadSavedDoc.onCreated(function() {
  this.subscribe('temp-cms-publications', TEMPcmsPlugin.updateGlobalInstanceStore );
});

Template.tempCMS__loadSavedDoc.helpers({
  tempCms__constructors: function() {
    return TEMPcmsPlugin.getGlobalInstanceStore();
  }
});

Template.tempCMS__loadSavedDoc.events({
  'click .temp-cms-edit-doc-from-list': function() {
    return TEMPcmsPlugin.editPageGet( this );
  },
  'click .temp-cms-create-doc-from-list': function() {

    var listItems = ReactiveConstructors[ this.constructorName ].getCreatableTypes();

    return TEMPcmsPlugin.getSelectListOverview( listItems, this.constructorName, false, function( newItem ) {
      return TEMPcmsPlugin.editPageGet( newItem );
    });

  }
});