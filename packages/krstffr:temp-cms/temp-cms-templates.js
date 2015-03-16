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

  // no val? probably a reactive var which is not set?! TODO!
  if (!this.value)
    return 'editTemplate__noReactiveInstanceSet';

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

    // If there is no value set, it's probably (TODO!??)
    // a reactive instance which is not yet set!
    if (!this.value && this.key && this.type)
      return this;

    // Else the "actual value" should be returned!
    return this.value;

  },
  className: function () {
    return this.constructor.name;
  }
});

Template.editTemplate__wrapper.events({
  'click .temp-cms-close-button': function ( e, tmpl ) {

    e.stopImmediatePropagation();

    Blaze.remove(tmpl.view);
    
  }
});

Template.editTemplate.events({
  'click .temp-cms-create-new-instance': function ( e ) {
    
    e.stopImmediatePropagation();

    var newItem = new window[this.type.replace(/Collection_/g, '')]();

    Template.currentData().setReactiveValue( this.key, newItem );

  },
  
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