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
