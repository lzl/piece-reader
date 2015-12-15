FlowRouter.route('/', {
  name: 'reader',
  action: function() {
    BlazeLayout.render("app", {subForm: "previewForm", publicContent: "demoPieces", privateContent: "readerPieces"});
  }
});

FlowRouter.route('/following', {
  name: 'following',
  action: function() {
    BlazeLayout.render("app", {subForm: "previewForm", publicContent: "signIn", privateContent: "followingSubs"});
  }
});

FlowRouter.route('/follow', {
  name: 'follow',
  action: function() {
    BlazeLayout.render("app", {subForm: "followForm", publicContent: "previewPieces", privateContent: "previewPieces"});
  }
});
