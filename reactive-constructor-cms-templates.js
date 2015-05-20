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
    if (this.reactiveConstructorCmsName){
      return 'Link to: <strong>' + this.reactiveConstructorCmsName + '</strong> ('+ this.getType() +')';
    }
    if (this.value)
      return 'Create new: <strong>' + this.value + '</strong>';
    throw new Error('reactive-constructor-cms', 'No button text?');
  }
});

Handlebars.registerHelper('getTemplateFromType', function () {

  if (!this.type || !this.key)
    return 'editTemplate';

  // Is it a string? Return the basic template
  if (this.type === 'String' || this.type === 'Number' || this.type === 'Date'){
    var instance = Template.parentData(1).value || Template.parentData(1);
    // If the instance (probably a linked instance) do not have a getInputType
    // method, just return the String method.
    if (!instance.getInputType)
      return 'editTemplate__String';
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
  isBackup: function() {
    if (this.getReactiveValue)
      return this.getReactiveValue('reactiveConstructorCmsStatus') === 'backup';
    return false;
  },
  // This helper decides if the list of values for this instance should be shown or not.
  // This is right now used for not showing fields of linked DB docs.
  isLinkedInstance: function() {
    // All values in this array should be tested
    var testValues = [ this.type ];
    // If we also have a this.value.type field, add it to the check
    if (this.value && this.value.type)
      testValues.push(this.value.type);
    // All of them should pass!
    return _.some(testValues, function(value){
      return value === 'reactive-constructor-cms-linked-item';
    });
  },
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
    if (instance.constructor.constructorName)
      return instance.constructor.constructorName;
  },
  getType: function() {

    var instance = this.value || this;

    // Is it a linked instance?
    // Then get the name of the linnked instance (as well as the type!)
    if (instance.type === 'reactive-constructor-cms-linked-item'){
      var constructorName = instance.constructorName || this.type;
      var savedInstances = _.findWhere(ReactiveConstructorCmsPlugin.getGlobalInstanceStore(), {
        constructorName: constructorName
      }).items;
      var savedInstance = _.findWhere(savedInstances, { _id: instance._id });
      // Did we find a saved instance? And does it have a cms-name? If yes: return it!
      if (savedInstance && savedInstance.reactiveConstructorCmsName)
        return savedInstance.reactiveConstructorCmsName;
    }

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

  console.log( value, type );

  if (!value && type !== 'Number' && type !== 'Boolean')
    return instance.unsetReactiveValue( key );

  return instance.setReactiveValue( key, value );

};

Template.editTemplate__wrapper.events({
  'click .reactive-constructor-cms-go-back-one-backup-version': function() {
    var instance = this;
    return instance.getBackupDoc(0, function(err, res) {
      if (res)
        return ReactiveConstructorCmsPlugin.editPageGet( new instance.constructor( res ) );
    });
  },
  'click .reactive-constructor-cms-close-button': function () {
    return ReactiveConstructorCmsPlugin.editPageRemove( this );
  },
  'click .reactive-constructor-cms-unpublish-button': function() {
    
    if (!confirm('Are you sure you want to unpublish this ' + this.getType() + '?'))
      return false;

    return this.unpublish();

  },
  'click .reactive-constructor-cms-remove-button': function() {
    
    if (!confirm('Are you sure you want to remove this ' + this.getType() + '?'))
      return false;

    this.deleteInstance( function( err, res ) {
      // If at least one doc was removed, then remove the edit page.
      if (res > 0)
        return ReactiveConstructorCmsPlugin.editPageRemove();
    });
  },
  'click .reactive-constructor-cms-publish-button': function () {
    return this.save({ publish: true });
  },
  'click .reactive-constructor-cms-save-draft-button': function () {
    return this.save({});
  },
  'click .reactive-constructor-cms-duplicate-button': function() {
    var instance = this;
    return instance.save({ duplicate: true }, function( err, res ) {
      if ( res.edit ){
        var createdInstance = ReactiveConstructorCmsPlugin.getInstanceByTypeAndId( instance.constructor.constructorName, res.edit.insertedId );
        return ReactiveConstructorCmsPlugin.editPageGet( createdInstance );
      }
    });
  }
});

Template.editTemplate__wrapper.onRendered(function() {
  $('.reactive-constructor-cms-wrapper').draggable();
});

Template.editTemplate.events({
  'click .reactive-constructor-cms-move-collection-item': function( e ) {

    e.stopImmediatePropagation();

    var clickedBtn = $( e.currentTarget );
    var moveTo = (clickedBtn.data('move') === 'up') ? -1 : 1;
    var listItem = $(e.currentTarget).closest('.wrap');
    var context = Blaze.getData( listItem.closest('.collection__items')[0] );
    var parentInstance = Blaze.getData( listItem.closest('.collection').closest('.wrap')[0] );

    parentInstance = parentInstance.value || parentInstance;

    return parentInstance.arrayitemMove( context.key, listItem.index()+(moveTo), listItem.index() );

  },
  'click .reactive-constructor-cms-relink-nested-instance': function( e ) {

    if (!confirm('Are you sure you want to switch this item for a new one?'))
      return false;
    
    e.stopImmediatePropagation();

    var constructorName;
    var listItems;
    var parentInstance;
    var contextKey;

    if ( this.value ){

      // If this.value is set, it's not an array item

      // Get the key of the field which holds this nested instance
      var key = this.key;
      // Get the parent instance (might be stored in the value field!)
      parentInstance = Blaze.getData( $(e.currentTarget).closest('.wrap').parent('.wrap')[0] );
      parentInstance = parentInstance.value || parentInstance;
      // Get the constructor name
      constructorName = this.type.replace(/Collection_/g, '');
      // Get all list items which the user can choose from.
      listItems = ReactiveConstructors[ constructorName ].getCreatableTypes( key, parentInstance );
      listItems = listItems.concat( parentInstance.getLinkableInstances( key ) );

      return ReactiveConstructorCmsPlugin.getSelectListOverview( listItems, constructorName, key, function( newItem, instance, key ) {
        return instance.setReactiveValue( key, newItem );
      }, parentInstance );


    } else {
      // If there is no this.value, it's an array item

      // This is the current list item
      var listItem = $(e.currentTarget).closest('.wrap');
      
      // This is the current list item's position in the list.
      // This is used later when setting the new position of the substituted instance
      var listItemPosition = listItem.index();
      
      // This is the key for the list. Used for updating the list (selecting the list)
      contextKey = Blaze.getData( listItem.closest('.collection__items')[0] ).key;
      
      // This is the parent, which is what get's updated
      parentInstance = Blaze.getData( listItem.closest('.collection').closest('.wrap')[0] );

      parentInstance = parentInstance.value || parentInstance;

      // This is the constructor name. Depending on if it's a linked instance or an
      // "ordinary" instance this will be stored in different places
      constructorName = this.constructorName || this.constructor.constructorName;

      // These are the listItems which the user can use among for this key.
      listItems = ReactiveConstructors[ constructorName ].getCreatableTypes( contextKey, parentInstance );
      // Also add all linkable instances
      listItems = listItems.concat( parentInstance.getLinkableInstances( contextKey ) );

      return ReactiveConstructorCmsPlugin.getSelectListOverview( listItems, constructorName, contextKey, function( newItem, instance, key ) {
        
        // First remove the current item
        instance.arrayitemRemove( key, listItemPosition );

        // Get the items, and add the new item
        var items = instance.getReactiveValue( contextKey );
        items.push( newItem );
        parentInstance.setReactiveValue( key, items );

        // Move the new item to the last items position
        return parentInstance.arrayitemMove( key, listItemPosition, items.length - 1 );

      }, parentInstance );

    }

  },
  'click .reactive-constructor-cms-open-child-instance': function() {

    var instance = this.value || this;

    // This is not a "linked" object, but a directly nested one
    if ( Match.test( instance.getReactiveValue, Function ) )
      return ReactiveConstructorCmsPlugin.editPageGet( instance );
    
    instance = ReactiveConstructorCmsPlugin.getInstanceByTypeAndId( instance.constructorName, instance._id );
    return ReactiveConstructorCmsPlugin.editPageGet( instance );

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

    if (!confirm('Are you sure you want to remove this part?'))
      return false;

    var instanceItem = $( e.currentTarget ).closest('.wrap');
    var parentItem = instanceItem.parent().closest('.wrap')[0];
    var parentInstance = Blaze.getData( parentItem );

    parentInstance = parentInstance.value || parentInstance;

    return parentInstance.unsetReactiveValue( this.key );

  },
  'click .reactive-constructor-cms-remove-collection-item': function ( e ) {

    e.stopImmediatePropagation();

    if (!confirm('Are you sure you want to remove this part?'))
      return false;

    var listItem = $(e.currentTarget).closest('.wrap');
    var context = Blaze.getData( listItem.closest('.collection__items')[0] );
    var parentInstance = Blaze.getData( listItem.closest('.collection').closest('.wrap')[0] );

    parentInstance = parentInstance.value || parentInstance;

    parentInstance.arrayitemRemove( context.key, listItem.index() );

  },
  'click .reactive-constructor-cms-create-new-instance': function ( e ) {

    e.stopImmediatePropagation();

    var instance = Template.currentData().value || Template.currentData();
    var constructorName = this.type.replace(/Collection_/g, '');
    var key = this.key;
    var listItems = ReactiveConstructors[ constructorName ].getCreatableTypes( key, instance );

    listItems = listItems.concat( instance.getLinkableInstances( key ) );

    return ReactiveConstructorCmsPlugin.getSelectListOverview( listItems, constructorName, key, function( newItem, instance, key ) {
      return instance.setReactiveValue( key, newItem );
    }, instance );

  },
  // Method for adding new items to a collection
  'click .reactive-constructor-cms-add-new-coll-item': function ( e ) {

    e.stopImmediatePropagation();

    var key = this.key;
    var instance = Template.currentData().value || Template.currentData();
    var constructorName = this.type.replace(/Collection_/g, '');
    var listItems = ReactiveConstructors[ constructorName ].getCreatableTypes( key, instance );

    listItems = listItems.concat( instance.getLinkableInstances( key ) );

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
  this.subscribe('reactive-constructor-cms__editable-docs', ReactiveConstructorCmsPlugin.updateGlobalInstanceStore );
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