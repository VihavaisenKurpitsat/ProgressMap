ProgressApp.service('AssignmentCirclesService', function (MapScaleService) {

	this.drawCircle = function(assignment, students) {
		var location = assignment.location;
		var percentageCompleted = assignment.doers.length / students.length * 100;

        var circle = new paper.Path.Circle(location, MapScaleService.getRelativeX(35));
        circle.scale(window.innerWidth / MapScaleService.getPreviousWindowWidth());
        
        circle.fillColor = 'yellow';
        circle.fillColor.hue += percentageCompleted;

        //assignment numbers over assignment circles
        var text = new paper.PointText({
                   		point: location,
                        content: assignment.number,
                        fillColor: 'white',
                        fontSize: MapScaleService.getRelativeX(20)
        });

        //percentage over assignment circles
        var percentageLocationPoint = {'x': location.x, 'y': location.y + MapScaleService.getRelativeX(20) };

        var percentage = new paper.PointText({
                        point: percentageLocationPoint,
                        content: Math.floor(percentageCompleted) + "%",
                        fillColor: 'white'
        });
        paper.view.update();
	}

    /*this.updateCircleAfterNewDoer = function(assignment, students) {
        var location = assignment.location;

        var hitTest = paper.project.hitTest(location);

        if (! hitTest) {
            console.log("circle not found. couldn't update.")
            return;
        }

        var circle = hitTest.item;
        var percentageCompleted = assignment.doers.length / students.length * 100;

        circle.fillColor = 'yellow';
        circle.fillColor.hue += percentageCompleted;

        var percentageLocationPoint = {'x': location.x, 'y': location.y + MapScaleService.getRelativeX(20) };

        var hitTest = paper.project.hitTest(percentageLocationPoint);
        
        if (! hitTest) {
            console.log("percentage not found. couldn't update.")
            return;
        }

        hitTest.item.content = Math.floor(percentageCompleted) + "%";
        paper.view.update();
    } */
})