Template.editTemplate__selectOverview.onCreated(function() {
  // The list view should be 'list' by default
  if (this.data)
    this.data.listView = new ReactiveVar( this.data.listView || 'list' );
});

Template.editTemplate__selectOverview.onRendered(function() {
  var wrapper = $( this.find('.reactive-constructor-cms__select-overview') );
  wrapper.css({ top: $(window).scrollTop() });
  wrapper.removeClass('reactive-constructor-cms__select-overview--hidden');
});

var hideSelectOverviewCallback = function() {
  var removeTemplateCallback = Template.parentData(0).removeTemplateCallback;
  // Execute the callback!
  return removeTemplateCallback();
};

Template.editTemplate__selectOverview.events({
  'click .reactive-constructor-cms__select-overview__toggle-view': function() {
    return this.listView.set( (this.listView.get() === 'list') ? 'overview' : 'list' );
  },
  'click .reactive-constructor-cms__select-overview__select-item': function() {
    // Make sure we have a callback function!
    var callback = Template.parentData(0).callback;
    // Execute the callback!
    return callback( this );
  },
  'click .reactive-constructor-cms__select-overview__close': hideSelectOverviewCallback,
  'click .reactive-constructor-cms__select-overview__fader': hideSelectOverviewCallback
});

Template.editTemplate__selectOverview.helpers({
  selectableItems: function() {
    return _.sortBy( this.selectableItems, 'value' );
  },
  listViewIs: function( viewName ) {
    return this.listView.get() === viewName;
  },
  buttonValue: function() {
    if ( this.value )
      return 'Create new: <strong>' + this.value + '</strong>';
    if ( this.getReactiveValue('reactiveConstructorCmsName') )
      return 'Link to: <strong>' + this.getReactiveValue('reactiveConstructorCmsName') + '</strong> ('+ this.getType() +')';
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
    if (userSpecifiedInput === 'select')
      return 'editTemplate__Select';

    return 'editTemplate__String';
  }

  // Is it a boolean?
  if (this.type === 'Boolean')
    return 'editTemplate__Boolean';

  // Is it a collection of items?
  if (this.type.search(/Collection_/g) > -1)
    return 'editTemplate__ListOfInstances';

  // no val? probably a reactive var which is not set?! TODO!
  if (!this.value)
    return 'editTemplate__noReactiveInstanceSet';

  return 'editTemplate';

});

Handlebars.registerHelper('equals', function(a, b) {
  return a === b;
});

Template.editTemplate__ListOfInstances.onRendered(function () {

  // This is the wrapper for the elements which will be sortable
  var sortableWrapper = this.find('.reactive-constructor-cms__list-of-instances__instances');

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
      var parentContext = Blaze.getData( $(this).closest('.reactive-constructor-cms__instance-wrapper')[0] );
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

var getType = function() {

  var instance = this.value || this;

  // Is it a linked instance?
  // Then get the name of the linnked instance (as well as the type!)
  if (instance.type === 'reactive-constructor-cms-linked-item'){
    var constructorName = instance.constructorName || this.type;
    var collection = ReactiveConstructors[ constructorName ].getCollection();
    if (!collection)
      throw new Error('reactive-constructor-cms', 'Could not find collection for linked instance?');
    var savedInstance = collection.findOne( instance._id, {
      transform: doc => new ReactiveConstructors[ constructorName ]( doc )
    });
    // Did we find a saved instance? And does it have a cms-name? If yes: return it!
    if (savedInstance)
      return savedInstance.getReactiveValue('reactiveConstructorCmsName');
    // If we did not find it, it is probably removed?
    return 'Removed?';
  }

  var type = '';
  if ( instance.getType && ( instance.getType.constructor === Function ))
    type = instance.getType();
  if (instance.type)
    type = instance.type;
  return type.charAt(0).toUpperCase() + type.slice(1);
};

Template.editTemplate__linkedInstance.helpers({
  getType: getType
});

Template.editTemplate.helpers({
  showImagePreview: function() {
    return this.fieldCmsOptions && this.fieldCmsOptions.previewImage;
  },
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
  // Check if this instance is a nested instance (meaning another instance from a reactive constructor)
  isNestedInstance: function () {
    return (this.value && this.value.constructorName) || (this.value && this.value.rcType);
  },
  // Check if the item is part of a list of instances or a "single instance"
  // Compare these two:
  // key: [ ConstructorName ] <- List
  // key: ConstructorName     <- Single instance, not a list
  isSingleInstance: function() {
    return this.key && this.value && this.type;
  },
  getReactiveValuesAsArray: function() {
    var instance = this.value || this;
    if ( instance.getReactiveValuesAsArray && ( instance.getReactiveValuesAsArray.constructor === Function ))
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
    if (this.constructorName)
      return this.constructorName;
  },
  getType: getType
});

// TODO this is not clean at all actually.
var updateInput = function ( value, key, type, instance ) {

  if (type === 'Number')
    value = parseFloat( value, 10 ) || 0;

  if (type === 'Date')
    value = new Date( value );

  instance = instance || Template.currentData().value || Template.currentData();

  // TODO: Is this ever used anymore?
  // If it is: it's not good!
  if (!value && type !== 'Number' && type !== 'Boolean' && type !== 'String')
    return instance.unsetReactiveValue( key );

  return instance.setReactiveValue( key, value );

};

// Method for toggling the current instance header (text and "edit buttons")
var toggleInstanceHeader = _.debounce( function ( menuEl ) {
  return $('.reactive-constructor-cms__instance-wrapper__header')
  .addClass('reactive-constructor-cms__instance-wrapper__header--visible')
  .not( menuEl )
  .removeClass('reactive-constructor-cms__instance-wrapper__header--visible');
}, 80 );

Template.editTemplate__wrapper.helpers({
  instance() {
    return this.instance || ReactiveConstructorCmsPlugin
    .getCollectionFromConstructorName( this.constructorName )
    .findOne( this.id, {
      transform: doc => new ReactiveConstructors[ this.constructorName ]( doc )
    });
  }
});

Template.editTemplate__wrapper.events({
  'click .reactive-constructor-cms-ACTION--goto-parent-instance': function() {

    // Make sure we have a parentInstance (else we would never get to this place!)
    if (!this.parentInstance)
      return false;

    // Make sure it is a ReactiveConstructor object (this is basically duck typing?)
    if (this.parentInstance.getReactiveValue.constructor !== Function)
      throw new Error('reactive-constructor-cms', 'No getReactiveValue method on parent?');

    // Open the parent instance!
    return ReactiveConstructorCmsPlugin.editPageGet({
      id: this.parentInstance._id,
      constructorName: this.parentInstance.constructor.constructorName
    });

  },
  'click .reactive-constructor-cms-ACTION--load-next-backup-of-instance': function() {
    var instance = this;
    return instance.getBackupDoc(0, function(err, res) {
      if (res)
        return ReactiveConstructorCmsPlugin.editPageGet({ instance: new instance.constructor( res ) });
    });
  },
  'click .reactive-constructor-cms-ACTION--close-main-wrapper': function () {
    return ReactiveConstructorCmsPlugin.editPageRemove();
  },
  'click .reactive-constructor-cms-ACTION--unpublish-instance': function() {

    if (!confirm('Are you sure you want to unpublish this ' + this.getType() + '?'))
      return false;

    return this.unpublish();

  },
  'click .reactive-constructor-cms-ACTION--remove-instance': function() {

    if (!confirm('Are you sure you want to remove this ' + this.getType() + '?'))
      return false;

    this.deleteInstance( function( err, res ) {
      // If at least one doc was removed, then remove the edit page.
      if (res > 0)
        return ReactiveConstructorCmsPlugin.editPageRemove();
    });
  },
  'click .reactive-constructor-cms-ACTION--save-and-publish-instance': function () {
    return this.save({ publish: true });
  },
  'click .reactive-constructor-cms-ACTION--save-instance': function () {
    return this.save({});
  },
  'click .reactive-constructor-cms-ACTION--save-duplicate-of-instance': function() {
    var instance = this;
    return instance.save({ duplicate: true }, function( err, res ) {
      if ( res.edit )
        return ReactiveConstructorCmsPlugin.editPageGet({ id: res.edit, constructorName: instance.constructor.constructorName });
    });
  },
  'mouseenter .reactive-constructor-cms__instance-wrapper': function( e ) {
    return toggleInstanceHeader( $( e.currentTarget ).children('.reactive-constructor-cms__instance-wrapper__header').first() );
  },
  'mouseleave .reactive-constructor-cms__instance-wrapper': function( e ) {
    return toggleInstanceHeader(
      $( e.currentTarget )
      .parent()
      .closest('.reactive-constructor-cms__instance-wrapper')
      .children('.reactive-constructor-cms__instance-wrapper__header')
      .first()
    );
  }
});

Template.editTemplate__wrapper.onRendered( () => $('.reactive-constructor-cms__main-wrapper').draggable() );
Template.editTemplate__wrapper.onCreated(function () {
  this.autorun( () => {
    if (!this.data.constructorName || !this.data.id)
      return false;
    return this.subscribe('reactive-constructor-cms__editable-doc-from-id-and-constructorname', this.data.constructorName, this.data.id );
  });
});

Template.editTemplate.events({
  'click .reactive-constructor-cms-ACTION--change-value-using-overview': function( e ) {
    var parentInstance = Blaze.getData( $( e.currentTarget ).closest('.reactive-constructor-cms__instance-wrapper')[0] );
    return ReactiveConstructorCmsPlugin.getSelectListOverview( this.fieldCmsOptions.selectValues(), 'String', this.key, function( newValue, instance, key ) {
      return instance.setReactiveValue( key, newValue );
    }, parentInstance );
  },
  'click .reactive-constructor-cms-ACTION--move-instance-in-list': function( e ) {

    e.stopImmediatePropagation();

    var clickedBtn = $( e.currentTarget );
    var moveTo = (clickedBtn.data('move') === 'up') ? -1 : 1;
    var listItem = $(e.currentTarget).closest('.reactive-constructor-cms__instance-wrapper');
    var context = Blaze.getData( listItem.closest('.reactive-constructor-cms__list-of-instances__instances')[0] );
    var parentInstance = Blaze.getData( listItem.closest('.reactive-constructor-cms__list-of-instances').closest('.reactive-constructor-cms__instance-wrapper')[0] );

    parentInstance = parentInstance.value || parentInstance;

    return parentInstance.arrayitemMove( context.key, listItem.index()+(moveTo), listItem.index() );

  },
  'click .reactive-constructor-cms-ACTION--relink-nested-instance': function( e ) {

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
      parentInstance = Blaze.getData( $(e.currentTarget).closest('.reactive-constructor-cms__instance-wrapper').parent('.reactive-constructor-cms__instance-wrapper')[0] );
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
      var listItem = $(e.currentTarget).closest('.reactive-constructor-cms__instance-wrapper');

      // This is the current list item's position in the list.
      // This is used later when setting the new position of the substituted instance
      var listItemPosition = listItem.index();

      // This is the key for the list. Used for updating the list (selecting the list)
      contextKey = Blaze.getData( listItem.closest('.reactive-constructor-cms__list-of-instances__instances')[0] ).key;

      // This is the parent, which is what get's updated
      parentInstance = Blaze.getData( listItem.closest('.reactive-constructor-cms__list-of-instances').closest('.reactive-constructor-cms__instance-wrapper')[0] );

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
  'click .reactive-constructor-cms-ACTION--open-child-instance': function() {

    var instance = this.value || this;

    // This is not a "linked" object, but a directly nested one
    if ( instance.getReactiveValue && ( instance.getReactiveValue.constructor === Function ) )
      return ReactiveConstructorCmsPlugin.editPageGet({ instance: instance });

    return ReactiveConstructorCmsPlugin.editPageGet({ constructorName: instance.constructorName, id: instance._id });

  },
  'click .reactive-constructor-cms-ACTION--duplicate-instance-in-list': function ( e ) {

    e.stopImmediatePropagation();

    var listItem = $(e.currentTarget).closest('.reactive-constructor-cms__instance-wrapper');
    var context = Blaze.getData( listItem.closest('.reactive-constructor-cms__list-of-instances__instances')[0] );
    var parentInstance = Blaze.getData( listItem.closest('.reactive-constructor-cms__list-of-instances').closest('.reactive-constructor-cms__instance-wrapper')[0] );

    parentInstance = parentInstance.value || parentInstance;

    parentInstance.arrayitemDuplicate( context.key, listItem.index() );

  },
  'click .reactive-constructor-cms-ACTION--remove-nested-single-instance': function( e ) {

    e.stopImmediatePropagation();

    if (!confirm('Are you sure you want to remove this part?'))
      return false;

    var instanceItem = $( e.currentTarget ).closest('.reactive-constructor-cms__instance-wrapper');
    var parentItem = instanceItem.parent().closest('.reactive-constructor-cms__instance-wrapper')[0];
    var parentInstance = Blaze.getData( parentItem );

    parentInstance = parentInstance.value || parentInstance;

    return parentInstance.unsetReactiveValue( this.key );

  },
  'click .reactive-constructor-cms-ACTION--remove-instance-from-list': function ( e ) {

    e.stopImmediatePropagation();

    if (!confirm('Are you sure you want to remove this part?'))
      return false;

    var listItem = $(e.currentTarget).closest('.reactive-constructor-cms__instance-wrapper');
    var context = Blaze.getData( listItem.closest('.reactive-constructor-cms__list-of-instances__instances')[0] );
    var parentInstance = Blaze.getData( listItem.closest('.reactive-constructor-cms__list-of-instances').closest('.reactive-constructor-cms__instance-wrapper')[0] );

    parentInstance = parentInstance.value || parentInstance;

    parentInstance.arrayitemRemove( context.key, listItem.index() );

  },
  'click .reactive-constructor-cms-ACTION--add-new-instance': function ( e ) {

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
  'click .reactive-constructor-cms-ACTION--add-instance-to-list': function ( e ) {

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
  'change .reactive-constructor-cms-ACTION--select-input': function ( e ) {

    e.stopImmediatePropagation();

    var value = $(e.currentTarget).val();
    var instance = Template.currentData().value || Template.currentData();

    if (this.type === 'Boolean')
      value = value === 'true';

    instance.setReactiveValue( this.key, value );

  }
});

Template.reactiveConstructorCms__loadSavedDoc.onCreated(function() {
  this.autorun( () => this.subscribe('reactive-constructor-cms__editable-docs') );
});

Template.reactiveConstructorCms__loadSavedDoc.helpers({
  // Method for returning all saveable constructors
  saveableConstructors() {
    return _.chain( ReactiveConstructors )
    .filter( constructor => constructor.getCollection() !== false )
    .map( constructor => {
      return { constructorName: constructor.constructorName };
    }).value().sort();
  },
  // Method for returning all editable items in a constructor
  items() {
    return ReactiveConstructorCmsPlugin.getCollectionFromConstructorName( this.constructorName )
    .find({
      reactiveConstructorCmsStatus: 'edit'
    }, {
      sort: {
        reactiveConstructorCmsName: 1,
        updateTime:                -1
      },
      transform: doc => {
        doc.constructorName = this.constructorName;
        return doc;
      }
    });
  }
});

Template.reactiveConstructorCms__loadSavedDoc.events({
  'click .reactive-constructor-cms-ACTION--open-instance': function() {
    return ReactiveConstructorCmsPlugin.editPageGet({ id: this._id, constructorName: this.constructorName });
  },
  'click .reactive-constructor-cms-ACTION--create-new-instance': function() {

    var listItems = ReactiveConstructors[ this.constructorName ].getCreatableTypes();

    return ReactiveConstructorCmsPlugin.getSelectListOverview( listItems, this.constructorName, false, function( newItem ) {
      return ReactiveConstructorCmsPlugin.editPageGet({ instance: newItem });
    });

  }
});

Template.editTemplate__Select.onRendered(function() {
  var parentInstance = Blaze.getData( $( this.firstNode ).closest('.reactive-constructor-cms__instance-wrapper')[0] );
  if (!parentInstance || !parentInstance.getReactiveValue)
    return false;
  var currentValue = parentInstance.getReactiveValue( this.data.key );
  $( this.find('select') ).val( currentValue );
});
