
describe('MapController', function() {

  var ctrl, scope, httpMock;

  //template ei halua toimia..
  beforeEach(module('ngRoute', 'templates', 'ngResource'));

  beforeEach(inject(function($controller, $rootScope, $httpBackend) {
    httpMock = $httpBackend
    scope = $rootScope.$new()

    httpMock.when('post', '/users').respond( {"id":1},{"id":2}, "assignments" [{"id":1}], "locations" [{"id":1,"assignment_id":1,"x":10,"y":5}] )

    ctrl = $controller
    ctrl('MapController', {
      $scope: scope
    })
  }))

  it('the course is assigned to scope.course', function() {
    httpMock.expectGET('/map/index.json')
    httpMock.flush()

    expect(scope.course).toEqual('{"id":1}')
  })


  it('0 is 0', function() {
    expect(0).toBe(0);
  });

  afterEach(function() {
    httpMock.verifyNoOutstandingExpectation()
    httpMock.verifyNoOutstandingRequest()
  })
})