Subs = new Mongo.Collection('subs');
Subs.allow({
  insert() { return false; },
  update() { return false; },
  remove() { return false; }
});
Subs.deny({
  insert() { return true; },
  update() { return true; },
  remove() { return true; }
});

Clones = new Mongo.Collection('clones');
Clones.allow({
  insert() { return false; },
  update() { return false; },
  remove() { return false; }
});
Clones.deny({
  insert() { return true; },
  update() { return true; },
  remove() { return true; }
});

Meteor.users.allow({
  insert() { return false; },
  update() { return false; },
  remove() { return false; }
});
Meteor.users.deny({
  insert() { return true; },
  update() { return true; },
  remove() { return true; }
});

Pieces = new Mongo.Collection('pieces');
Pieces.schema = new SimpleSchema({
  type: {type: String, allowedValues: ['plaintext', 'sharism-piece', 'hyperlink']},
  content: {type: String, max: 2000, optional: true},
  owner: {type: String},
  ownerId: {type: String, regEx: SimpleSchema.RegEx.Id},
  hostname: {type: String},
  published: {type: Boolean},
  createdAt: {type: Date},
  imported: {type: Boolean, optional: true},
  importedAt: {type: Date, optional: true},
  origin: {type: Object, optional: true},
  'origin._id': {type: String, regEx: SimpleSchema.RegEx.Id},
  'origin.type': {type: String, allowedValues: ['plaintext', 'sharism-piece', 'hyperlink']},
  'origin.content': {type: String, max: 2000},
  'origin.owner': {type: String},
  'origin.ownerId': {type: String, regEx: SimpleSchema.RegEx.Id},
  'origin.hostname': {type: String},
  'origin.published': {type: Boolean},
  'origin.createdAt': {type: Date},
  'origin.imported': {type: Boolean, optional: true},
  'origin.importedAt': {type: Date, optional: true},
});
Pieces.attachSchema(Pieces.schema);
Pieces.allow({
  insert() { return false; },
  update() { return false; },
  remove() { return false; }
});
Pieces.deny({
  insert() { return true; },
  update() { return true; },
  remove() { return true; }
});
