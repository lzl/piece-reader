FlowRouter.route('/', {
  name: 'reader',
  action: function() {
    BlazeLayout.render("app", {subForm: "previewForm", publicContent: "demoPieces", privateContent: "hasSubOrNot", card: "readerPieces"});
  }
});

FlowRouter.route('/following', {
  name: 'following',
  action: function() {
    BlazeLayout.render("app", {publicContent: "signIn", privateContent: "hasSubOrNot", card: "followingSubs"});
  }
});

FlowRouter.route('/follow', {
  name: 'follow',
  action: function() {
    BlazeLayout.render("app", {subForm: "followForm", publicContent: "previewPieces", privateContent: "previewPieces"});
  }
});
