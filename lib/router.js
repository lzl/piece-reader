FlowRouter.route('/', {
  action: function() {
    BlazeLayout.render("app");
  }
});

FlowRouter.route('/follow', {
  action: function(params, queryParams) {
    BlazeLayout.render("follow");
  }
});
