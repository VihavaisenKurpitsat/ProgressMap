ProgressApp.service('ActionMapUpdaterService', function (AssignmentLatestDoersService, AssignmentCirclesService, MapScaleService, MoveStudentCircleService, StudentIconService) {

    var assignments; // muotoa {'id', 'number', 'location': {'x', 'y'}, latestDoers: {'id', 'location', 'reserved', 'leaving', 'dummy'}}
                     // latestDoersissa jokaisella tulee olla aina id ja location. Muut attribuutit ovat tilanteesta riippuen olemassa tai sitten ei, jos niitä ei ko. doerin kohdalla tarvita
                     // reserved = "'true', jos toinen opiskelija on varannut tämän opiskelijan position ja liikkuu tämän paikalle ko. intervalin aikana"
                     // leaving = "'true' jos tämä opiskelija siirtyy ko. intervalin aikana. on olemassa uusien siirtymälokaatioiden määrityksen aikana olemassa."
                     // dummy = "määritelty ja 'true', mikäli assignmentilla ei ole oikeasti tätä tekijää, mutta joku liikkuu tämän positioon ja on tehnyt siihen jo varauksen. tarvitaan myöhemmin tietona siitä, tuleeko kartalta poistaa 'circle' tämän positiosta. ei luonnollisesti poisteta circleä, jos dummy = true, sillä "dummy = true" tarkoittaa että kartalla ei ole tämän positiossa mitään.

    var students; // muotoa: {'id', 'lastDoneAssignment': {'number', 'timestamp'}, 'originalAssignment': {'number', 'timestamp'}}
                  // studentit sisältävät näemmä myös tietoa 'reserved' sekä 'leaving' arvoista, sillä ne ovat viitteinä assignmenteissa eivätkä kopioina

    var readyForNextUpdate = true; // true mikäli ketään ei odotus- eikä liikkumisjonoissa

    var endlessWaitingQueue = [];
    var normalWaitingQueue = [];
    var movingQueue = [];
    var movingInterval;
    var intervalLength = 40000;
    var minSpeed = 90;
    var maxStudentsToMoveAtTheSameTime = 5; // 1 <= maxStudentsToMoveAtTheSameTime <= maxStudentsToShowAroundAssignment

    var assignmentLayer;
    var percentageLayer;
    var studentLayer;

    this.readyForNextUpdate = function() {
        return readyForNextUpdate;
    }

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


 
    this.initialize = function(initial_assigments, stLayer, assLayer, perLayer) {
        assignments = initial_assigments;
        studentLayer = stLayer;
        assignmentLayer = assLayer;
        percentageLayer = perLayer;
    }

    this.initializeLatestDoer = function(doer, location) {
        doer['location'] = {'x': location.x, 'y': location.y};
    }

    this.update = function(new_students) {
        if (! students) {
            students = new_students;
            return;
        }

        var update = false;

        for (var i = 0; i < students.length; i++) {

            if (students[i].lastDoneAssignment != new_students[i].lastDoneAssignment) {
                students[i].originalAssignment = students[i].lastDoneAssignment;
                students[i].lastDoneAssignment = new_students[i].lastDoneAssignment;

                update = true;
            }
        }

        if (update) {
            doUpdate();
        }
    }

    /*
        Päivittää tilanteen siirtämällä opiskelijoita paikoista toisiin sekä lisäämällä kartalle
        opiskelijat, jotka eivät ole tällä hetkellä näkyvissä, mutta viime intervalin aikana
        tekivät jonkin tehtävän.

        Metodin sisäiset funktiokutsut tulee suorittaa samassa järjestyksessä kuin ne ovat nytkin.
    */

    function doUpdate() {
        var studentsToMove = movingStudents();

        if (studentsToMove.length > 0) {
            readyForNextUpdate = false;
        }

        console.log("moving students during this interval")
        console.log(studentsToMove)

        setLeavingAttributesForAssignmentsLatestDoersMovingStudents(studentsToMove);
        setStudentsWaitingForMoving(studentsToMove);
        
        removeMovingStudentsFromTheirOriginalAssingmentsLatestDoers(studentsToMove);

        placeStudentsOnMapWhichAreNotThereYetButNowShouldBe(studentsToMove);
    }

    function placeStudentsOnMapWhichAreNotThereYetButNowShouldBe(movingStudents) {

        for (var i = 0; i < students.length; i++) {
            var student = students[i];
            var lastDoneAssignment = student.lastDoneAssignment;

            if (lastDoneAssignment) {
                var destinationAssignment = assignments[lastDoneAssignment.number - 1];
                var originalAssignment = AssignmentLatestDoersService.originalAssignment(student, assignments);

                if ((! originalAssignment || ! AssignmentLatestDoersService.studentIsInLatestDoersOfAssignment(student, originalAssignment)) &&
                    ! studentInMovingStudents(student, movingStudents) &&
                    ! AssignmentLatestDoersService.studentIsInLatestDoersOfAssignment(student, destinationAssignment) &&
                    AssignmentLatestDoersService.studentShouldBeInLatestDoersOfAssignment(student, destinationAssignment)) {

                    var endPosition = AssignmentLatestDoersService.nextPositionToMoveToAroundAssignment(student, destinationAssignment);

                    removeStudentFromEndPosition(destinationAssignment, endPosition);
                    markAssignmentAsDone(student, destinationAssignment, endPosition);
                    createStudentCircleInPosition(student, endPosition);
                }
            }
        }
    }

    function studentInMovingStudents(student, movingStudents) {
        for (var i = 0; i < movingStudents.length; i++) {
            if (student.id == movingStudents[i].id) {
                return true;
            }
        }
        return false;
    }

    function createStudentCircleInPosition(student, scaledPosition) {
        var circle = new paper.Path.Circle(new paper.Point(scaledPosition.x, scaledPosition.y), MapScaleService.scaleByDefaultWidth(15));
        circle.fillColor = StudentIconService.colorOfCircleOfStudent(student);
        studentLayer.appendBottom(circle);

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
                    AssignmentLatestDoersService.studentIsInLatestDoersOfAssignment(student, originalAssignment) &&
                    AssignmentLatestDoersService.studentShouldBeInLatestDoersOfAssignment(student, destinationAssignment)) {

                    movingStudents.push(student);
                }
            }
        }
        return movingStudents;
    }

    function setStudentsWaitingForMoving(movingStudents) {
        for (var i = 0; i < movingStudents.length; i++) {
            var student = movingStudents[i];
            var lastDoneAssignment = student.lastDoneAssignment;
            var destinationAssignment = assignments[lastDoneAssignment.number - 1];

            placeStudentToWait(student, destinationAssignment, i, movingStudents.length);
        }
    }

    /*
        Kaikki liikkujat laitetaan normalWaitingQueueen, mutta ainoastaan 9 ekalle määritetään 'timeout' liikkeellelähtöä
        varten. Loput, jotka eivät timeoutia saa, lähetetään liikkeelle yksi kerrallaan, kun joku liikkuva pääsee perille.
    */

    function placeStudentToWait(student, destinationAssignment, ithMover, movingStudentsDuringInterval) {
        var time = waitingTime(ithMover, movingStudentsDuringInterval);
        console.log(time)

        if (time < Number.MAX_VALUE) {
            placeStudentToWaitingQueue(student, normalWaitingQueue, destinationAssignment);

            console.log("set timeout: " + ithMover)

            setTimeout(function() {
                setNextStudentMoving(normalWaitingQueue);
            }, time);               
        }

        else {
            placeStudentToWaitingQueue(student, endlessWaitingQueue, destinationAssignment);
        }
    }

    /*
        Eka opiskelija saa odottaa jonkin aikaa, jotta kaikki siirrettävät opiskelijat ehditään varmasti ensin
        poistaa oman originalAssignmentin latestDoersista. Tämä suoritetaan, kun kaikille opiskelijoille on määritetty
        waitTillMove = setTimeout(function() { ... }).

        Viimeinen mahdollinen liikkeellelähtöaika on ajoitettu ajaksi 'intervalLength / 2', jotta opiskelija pääsee
        varmasti perille ennen kuin interval päättyy. Jos ei ehdi, niin teleporttaa seuraavan intervalin aikana ja
        ei poista vanhaa palluraa.
    */

    function waitingTime(ithMover, movingStudentsDuringInterval) {
        if (ithMover < maxStudentsToMoveAtTheSameTime) {
            return intervalLength / 20 + (ithMover / movingStudentsDuringInterval) * (intervalLength / 2);
        }
        return Number.MAX_VALUE;
    }

    /*
        Laittaa liikkujan joko normaaliin odotusjonoon, johon liittyy aikakeskeytys tai loputtomaan odotusjonoon,
        josta pääsee pois, kun joku liikkuja saapuu perille.
    */

    function placeStudentToWaitingQueue(student, queue, destinationAssignment) {
        var circle = getStudentCircle(student);
        circle.bringToFront();

        var endPosition = AssignmentLatestDoersService.nextPositionToMoveToAroundAssignment(student, destinationAssignment);

        var movingInfo = {'circle': circle,
                          'destinationAssignment': destinationAssignment,
                          'startPosition': circle.position,
                          'endPosition': endPosition,
                          'student': student,
                          'speed': minSpeed }

        queue.push(movingInfo);
    }

    function getStudentCircle(student) {
        var originalAssignment = AssignmentLatestDoersService.originalAssignment(student, assignments);
        var location = AssignmentLatestDoersService.getLocationOfStudent(student, originalAssignment);
        
        return getItemFromStudentLayer(location);
    }

    /*
        Hae queue:sta sitä studentia koskeva movingInfo, joka aiheutti 'timeout' keskeytyksen (ko. movingInfo
        sattuu olemaan aina ensimmäisenä).
        Tämän jälkeen laita movingInfo movingQueueen ja aloita movingInfoa koskevan studentCirclen liikuttaminen
        resetMovingIntervalilla.
    */

    function setNextStudentMoving(queue) {
        var movingInfo = queue.shift(); // pop first

        movingQueue.push(movingInfo);
        resetMovingInterval();
    }

    function setLeavingAttributesForAssignmentsLatestDoersMovingStudents(movingStudents) {
        for (var i = 0; i < movingStudents.length; i++) {
            var student = movingStudents[i];

            var originalAssignment = AssignmentLatestDoersService.originalAssignment(student, assignments);
            AssignmentLatestDoersService.setStudentToLeaveItsLastDoneAssignment(student, originalAssignment);

        }
    }

    function removeMovingStudentsFromTheirOriginalAssingmentsLatestDoers(movingStudents) {
        for (var i = 0; i < movingStudents.length; i++) {
            var student = movingStudents[i];

            var originalAssignment = AssignmentLatestDoersService.originalAssignment(student, assignments);
            removeStudentFromLatestDoersOfAssignment(student, originalAssignment);
        }
    }

    /*
        Poistaa opiskelijan assignmentin latestDoersista ja asettaa tilalle toisen, jos kukaan muu ei ole
        tämän positiota varannut, ja on olemassa sellainen opiskelija, joka on ko. assignmentin viimeksi tehnyt
        ja ei tällä hetkellä latestDoersissa mukana.
    */

    function removeStudentFromLatestDoersOfAssignment(student, originalAssignment) {
        var doer = AssignmentLatestDoersService.removeStudentFromLatestDoersOfAssignment(student, originalAssignment);

        if (! doer.reserved) {
            var studentToAdd = AssignmentLatestDoersService.studentToAddInPlaceOfRemovedOne(originalAssignment, students);

            if (studentToAdd) {
                AssignmentLatestDoersService.addStudentToLatestDoersWithLocation(studentToAdd, originalAssignment, doer.location);
                createStudentCircleInPosition(studentToAdd, doer.location);
            }
        }
    }    

    function markAssignmentAsDone(student, assignment, position) {
        AssignmentLatestDoersService.addStudentToLatestDoersWithLocation(student, assignment, position);

        assignment.doers.push(student);
        AssignmentCirclesService.updateCircleAfterNewDoer(assignment, students, assignmentLayer, percentageLayer);
    }

    /*
        Yrittää poistaa opiskelijan assignmentin latestDoersista. Mikäli poisto-operaatio onnistuu ja palauttaa 'true',
        poistetaan kartalta myös poistettavaa opiskelijaa vastaava circle.
    */

    function removeStudentFromEndPosition(assignment, endPosition) {
        if (AssignmentLatestDoersService.removeStudentFromLatestDoersOfAssignmentFromPosition(assignment, endPosition)) {
            removeItemFromPosition(endPosition);
        }
    }

    function removeItemFromPosition(position) {
        var item = getItemFromStudentLayer(position);

        console.log("removing item")

        console.log(item)

        if (item) {
            item.remove();
            paper.view.update();
        }

        else {
            console.log("item to remove not found")
        }
    }
    
    function getItemFromStudentLayer(location) {
        var hitTest = studentLayer.hitTest(location);

        if (hitTest) {
            return hitTest.item;
        }
    }


    /*
        Resetoi aikavälin, jolloin studenteja liikutetaan eteenpäin.
        Jos liikutettavia on vielä jäljellä, luo uuden intervalin, jonka sisällä
        opiskelijoita liikutetaan.
    */

    function resetMovingInterval() {
        if (movingInterval) {
            clearInterval(movingInterval);
        }

        if (movingQueue.length > 0) {

            movingInterval = setInterval(function() {
                moveNextStudent();
            }, 1000 / (60 * movingQueue.length));
        }

        else if (normalWaitingQueue.length == 0 && endlessWaitingQueue.length == 0) {
            readyForNextUpdate = true;
        }
    }


    function moveNextStudent() {
        var movingInfo = movingQueue.shift(); // pop from queue

        var circle = movingInfo.circle;
        var endPosition = movingInfo.endPosition;

        var newSpeed = MoveStudentCircleService.moveCircle(circle, movingInfo.startPosition, endPosition, movingInfo.speed, minSpeed);
        movingInfo.speed = newSpeed;

        if (MoveStudentCircleService.hasReachedDestination(circle, endPosition)) {
            updateViewAfterStudentHasReachedDestination(movingInfo);
            return;
        }

        else if (! movingInfo.studentRemovedFromEndPosition &&
                 MoveStudentCircleService.approachingDestination(circle, endPosition)) {

            removeStudentFromEndPosition(movingInfo.destinationAssignment, endPosition);
            movingInfo.studentRemovedFromEndPosition = true;
        }

        movingQueue.push(movingInfo);
    }

    function updateViewAfterStudentHasReachedDestination(movingInfo) {
        var endPosition = movingInfo.endPosition;

        markAssignmentAsDone(movingInfo.student, movingInfo.destinationAssignment, endPosition);
        movingInfo.circle.position = endPosition;

        paper.view.update();

        if (endlessWaitingQueue.length > 0) {
            setNextStudentMoving(endlessWaitingQueue);
        }
        else {
            resetMovingInterval();
        }
    }
})