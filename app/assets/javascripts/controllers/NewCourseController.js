ProgressApp.controller('NewCourseController', function($scope, $location, $log, httpService, StateService) {

    // 1. Etsittyä useria voi klikata jolloin se lisätään participants scopeen.
    // 2. Participants scopessa olevia usereita ei voi enää klikata uudestaan.
    //    -Participantiksi lisättävälle opiskelijalle lisätään ylimääräinen attribuutti 'lisätty kurssille'.
    // 3. Lopuksi tehdään kurssin luonnin yhteydessä HTTP post johon participantit mukaan.

    $scope.participants = [];

    httpService.getData('/users/all', {}).then(function(data){
        $scope.allUsers = data['users']

        $log.log($scope.allUsers)
    })

    $scope.createCourse = function() {
        var name = $scope.name
        var assignmentCount = $scope.assignmentCount

            var newCourse = {
                name: name,
                assignment_count: assignmentCount,
                participants: $scope.participants
            }


        httpService.addData('/courses', newCourse).then(function(data) {
            var path = "/map/" + data.id;
            $location.path(path);
        });
    }

    $scope.addUser = function(newParticipant) {
        if ($scope.participants.indexOf(newParticipant) == -1){
            $scope.participants.push(newParticipant);
        }
    }


});
