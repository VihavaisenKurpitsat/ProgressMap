ProgressApp.service('MoveStudentService', function (AssignmentLatestDoersService, AssignmentCirclesService, StudentIconService, MapScaleService) {

    var assignments;
    var students;

    var movingQueue = [];
    var movingInterval;
    var lastWaitTime = 0;
    var intervalLength = 5000;
    var minSpeed = 90;

    var studentLayer;
    var assignmentLayer;

    this.updateAssignmentLocations = function() {
        for (var i = 0; i < assignments.length; i++) {
            assignments[i].location.x = MapScaleService.getRelativeX(assignments[i].location.x);
        }
    }

    this.updateAssignmentsLatestDoersLocations = function() {
        for (var i = 0; i < assignments.length; i++) {

            for (var j = 0; j < assignments[i].latestDoers.length; j++) {
                assignments[i].latestDoers[j].location.x = MapScaleService.getRelativeX(assignments[i].latestDoers[j].location.x);
            }
        }
    }
 
    this.initialize = function(initial_assigments, stLayer, assLayer) {
        assignments = initial_assigments;
        studentLayer = stLayer;
        assignmentLayer = assLayer;
    }

    this.update = function(new_students) {
        students = new_students;

        placeNewStudentsOnMapWhichAreNotThereYetButNowShouldBe();
        moveStudents(movingStudents());
    }

    function placeNewStudentsOnMapWhichAreNotThereYetButNowShouldBe() {

        for (var i = 0; i < students.length; i++) {
            var student = students[i];
            var lastDoneAssignment = student.lastDoneAssignment;

            if (lastDoneAssignment) {
                var destinationAssignment = assignments[lastDoneAssignment.number - 1];

                if (! AssignmentLatestDoersService.originalAssignment(student, assignments) &&
                    AssignmentLatestDoersService.studentShouldBeInLatestDoersOfAssignment(student, destinationAssignment)) {

                    var endPosition = AssignmentLatestDoersService.nextPositionToMoveToAroundAssignment(student, destinationAssignment, studentLayer);

                    putStudentToLatestDoersOfAssignment(student, destinationAssignment, endPosition);
                    createStudentCircleInPosition(student, endPosition);

                    markAssignmentAsDone(student, destinationAssignment, endPosition);
                }
            }
        }
    }

    function createStudentCircleInPosition(student, scaledPosition) {
        var circle = new paper.Path.Circle(new paper.Point(scaledPosition.x, scaledPosition.y), 15 * window.innerWidth / MapScaleService.getPreviousWindowWidth());
        circle.fillColor = StudentIconService.colorOfCircleOfStudent(student);
        studentLayer.addChild(circle);

        paper.view.update();
    }    

    function movingStudents() {
        var movingStudents = [];

        for (var i = 0; i < students.length; i++) {
            var student = students[i];
            var lastDoneAssignment = student.lastDoneAssignment;

            if (lastDoneAssignment) {
                var destinationAssignment = assignments[lastDoneAssignment.number - 1];
                var originalAssignment = AssignmentLatestDoersService.originalAssignment(student, assignments); // undefined if not shown anywhere in map

                if (originalAssignment &&
                    originalAssignment != destinationAssignment &&
                    ! AssignmentLatestDoersService.studentIsInLatestDoersOfAssignment(student, destinationAssignment) &&
                    AssignmentLatestDoersService.studentShouldBeInLatestDoersOfAssignment(student, destinationAssignment)) {

                    movingStudents.push(student);
                }
            }
        }
        return movingStudents;
    }

   function moveStudents(movingStudents) {
        for (var i = 0; i < movingStudents.length; i++) {
            var student = movingStudents[i];
            var lastDoneAssignment = student.lastDoneAssignment;
            var originalAssignment = AssignmentLatestDoersService.originalAssignment(student, assignments);
            var destinationAssignment = assignments[lastDoneAssignment.number - 1];

            placeStudentToWait(student, originalAssignment, destinationAssignment, movingStudents.length);
        }

        lastWaitTime = 0;
    }

    function placeStudentToWait(student, originalAssignment, destinationAssignment, movingStudentsDuringInterval) {
        var time = waitingTime(movingStudentsDuringInterval);

        var waitTillMove = setTimeout(function() {
                                placeStudentInMovingQueue(student, originalAssignment, destinationAssignment);
                                resetMovingInterval();

                                clearTimeout(waitTillMove);
                            }, time);

        lastWaitTime = time;
    }

    function waitingTime(movingStudentsDuringInterval) {
        return lastWaitTime + intervalLength * Math.random() / movingStudentsDuringInterval;
    }

    function placeStudentInMovingQueue(student, originalAssignment, destinationAssignment) {
        var circleToMove = getStudentCircle(student, originalAssignment);

        var movingInfo = {'circle': circleToMove,
                          'originalAssignment': originalAssignment,
                          'destinationAssignment': destinationAssignment,
                          'startPosition': circleToMove.position,
                          'endPosition': AssignmentLatestDoersService.nextPositionToMoveToAroundAssignment(student, destinationAssignment),
                          'student': student,
                          'speed': minSpeed }; // vakionopeus alussa kaikilla sama

        console.log(movingInfo.startPosition);
        console.log(originalAssignment.location)
        console.log(movingInfo.endPosition)
        console.log(destinationAssignment.location)

        movingQueue.push(movingInfo);
    }

    function getStudentCircle(student, assignment) {
        var location = AssignmentLatestDoersService.getLocationOfStudent(student, assignment);
        console.log(location);

        return getItemFromStudentLayer(location); // huono ratkaisu, voi johtaa ongelmiin... toisaalta Paper -kamaa ei voi tallettaa hashiin, koska herjaa konsolissa ja ohjelma ei toimi myöskään oikein...
    }

    function getItemFromStudentLayer(location) {
        var hitTest = studentLayer.hitTest(location);

        if (hitTest) {
            return hitTest.item;
        }
        return null;
    }

    function resetMovingInterval() {
        if (movingInterval) {
            clearInterval(movingInterval);
        }

        movingInterval = setInterval(function() {

            if (movingQueue.length <= 0) {
                return;
            }

            var elem = movingQueue.shift(); // pop from queue

            var circleToMove = elem.circle;
            var startPosition = elem.startPosition;
            var endPosition = elem.endPosition;

            if (hasReachedDestination(circleToMove, endPosition)) {
                var student = elem.student;
                var originalAssignment = elem.originalAssignment;
                var destinationAssignment = elem.destinationAssignment;

                removeStudentFromLatestDoersOfAssignment(student, originalAssignment, startPosition);
                putStudentToLatestDoersOfAssignment(student, destinationAssignment, endPosition);

                circleToMove.position = endPosition;

                markAssignmentAsDone(student, destinationAssignment, endPosition);

                paper.view.update();
            }

            else {
                var newSpeed = moveCircle(circleToMove, startPosition, endPosition, elem.speed);
                elem.circle = circleToMove;
                elem.speed = newSpeed;

                movingQueue.push(elem);
            }
        }, 1000 / (60 * movingQueue.length))
    }

    function putStudentToLatestDoersOfAssignment(student, assignment, scaledPosition) {
        if (AssignmentLatestDoersService.latestDoersFull(assignment)) {
            AssignmentLatestDoersService.removeTheOldestStudentFromLatestDoers(assignment);
            removeItemFromPosition(scaledPosition);
        }

        AssignmentLatestDoersService.addStudentToLatestDoersWithLocation(student, assignment, scaledPosition);
    }

    function removeItemFromPosition(scaledPosition) {
        var item = getItemFromStudentLayer(scaledPosition);

        if (item) {
            item.remove();
            paper.view.update();
        }
    }

    function removeStudentFromLatestDoersOfAssignment(student, assignment, scaledPosition) {
        AssignmentLatestDoersService.removeStudentFromLatestDoersOfAssignment(student, assignment);
        var student = AssignmentLatestDoersService.studentToAddInPlaceOfRemovedOne(assignment, students);

        if (student) {
            AssignmentLatestDoersService.addStudentToLatestDoersWithLocation(student, assignment, scaledPosition);
            createStudentCircleInPosition(student, scaledPosition);
        }
    }    

    function hasReachedDestination(circle, destination) {
        var vector = getVector(circle, destination);
        return Math.abs(vector[0]) + Math.abs(vector[1]) < 1;
    }

    function getVector(circle, destination) {
        var position = circle.position;
        return [destination.x - position.x, destination.y - position.y];
    }

    function moveCircle(circle, startPosition, endPosition, speed) {
        var vector = getVector(circle, endPosition);
        var totalDistance = distanceBetweenPoints(startPosition, endPosition);
        var distanceRemaining = distanceBetweenPoints(circle.position, endPosition);

        circle.position.x += vector[0] / speed;
        circle.position.y += vector[1] / speed;

        if (distanceRemaining * 7 > totalDistance) {   // etäisyys yli 1/7 kokonaismatkasta kohteeseen
            speed -= 0.5;                              // nopeus kasvaa "smoothisti"
        }

        else if (distanceRemaining * 20 > totalDistance) { // nopeus alkaa laskemaan "smoothisti"
            speed += 0.1
        }
        else {
            speed += 0.02 // speed laskee vain vähän kun ollaan alle 5% etäisyydellä kohteeseen
        }

        paper.view.update();

        speed = Math.max(10, speed);                   // nopeus tulee olla 10+ ja 100-
        return Math.min(speed, minSpeed);
    }

    function distanceBetweenPoints(point1, point2) {
        return distance([point1.x, point1.y], [point2.x, point2.y]);
    }

    function distance(a, b) {
        return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
    }

    function markAssignmentAsDone(student, assignment, position) {
        assignment.doers.push(student);
        AssignmentCirclesService.updateCircleAfterNewDoer(assignment, students, assignmentLayer, studentLayer);

        AssignmentLatestDoersService.freePosition(assignment, position);
    }
})