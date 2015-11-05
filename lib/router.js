FlowRouter.route('/', {
  name: 'home',
  action: function() {
    BlazeLayout.render("app");
  }
});

FlowRouter.route('/follow', {
  name: 'follow',
  action: function(params, queryParams) {
    BlazeLayout.render("follow");
  }
});

FlowRouter.route('/following', {
  name: 'following',
  action: function() {
    BlazeLayout.render("following");
  }
});
