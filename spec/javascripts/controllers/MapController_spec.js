describe('MapController', function () {

    var controller, scope, logMock;
    var mapDataService;
    var CanvasServiceMock;
    var data = {};

    beforeEach(function () {
        module('ProgressApp');


        CanvasServiceMock = (function () {
            return {
                initiateCanvas: function (height, width, div, bgColor) {
                },
                drawSmoothPaths: function (locations) {
                }
            }
        })();

        //luodaan data testaamiselle (joka oikeasti saataisiin palvelusta)
        data.course = {"id": 1};
        data.assignments =
            [{"id": 1, "location": {"id": 1, "x": 100, "y": 250}, "doers": [{"id": 2}, {"id": 1}]},
                {"id": 2, "location": {"id": 2, "x": 330, "y": 180}, "doers": [{"id" : 1}]},
                {"id": 3, "location": {"id": 3, "x": 500, "y": 130}, "doers": [{"id": 1}]}];
        data.participants = [{"id": 1}, {"id": 2}, {"id": 3}];
        data.current_user = {"id": 2};

        inject(function ($controller, $rootScope, _MapDataService_, CanvasService) {
            scope = $rootScope.$new();
            mapDataService = _MapDataService_;
            controller = $controller('MapController', {
                $scope: scope,
                MapDataService: mapDataService,
                CanvasService: CanvasServiceMock
            });

            spyOn(mapDataService, 'initMap');
            mapDataService.initMap(data);

        });

        //asetetaan data scopeen (joka oikeasti tapahtuu MapDataServicen avulla)
        scope.course = data["course"][0]
        scope.assignments = data["assignments"]
        scope.participants = data["participants"]

        scope.current_user = data["current_user"][0]
        //$scope.done_assignments = doneAssignments($scope.current_user);
    });


    it('0 should be 0', function () {
        expect(0).toBe(0);
    })

    it('viewing as student sets done assignments when user id is valid', function () {
        scope.viewAsStudent(2);
        expect(scope.done_assignments.length).toBe(1);
    })

    it('Init was called on Controller initialize', function () {
        expect(mapDataService.initMap).toHaveBeenCalled();
    })


    it('should add a new student to course', function () {
	expect(scope.participants.length).toBe(3);
	// work to be done
    })
    
    it('if given assignment is done returns true', function () {
        scope.viewAsStudent(2);
        expect(scope.checkIfAssignmentIsDone(scope.done_assignments[0].id)).toBe(true);
    })

    it ('if given assignment is not done returns false', function () {
        expect(scope.checkIfAssignmentIsDone(scope.viewAsStudent(3))).toBe(false);
    })

    //ei toimi
    it('throws error when user id is not valid', function () {
//        expect(scope.viewAsStudent(4)).toThrowError("err");

    })

  

})

/*

 //   template ei halua toimia..
 beforeEach(module('ProgressApp'));

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
 /* httpMock.expectGET('/map/index.json')
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
 */
