Points = new Meteor.Collection("points");

Nbb = new FS.Collection("nbb", {
    stores: [
      new FS.Store.FileSystem("nbb", {})
    ]
});

Nbb.allow({
    insert: function (userId, doc) {
        return true;
    },
    update: function (userId, doc) {
        return true;
    }
});

if (Meteor.isClient) {

  Meteor.subscribe("points");

  function GetElementValue(doc, tag, instant) {
    var out = 0;
    var elems = doc.getElementsByTagName(tag);
    for (i=0;i<elems.length;i++){
      if (elems[i].getAttribute("contextRef") === instant) {
        out = elems[i].childNodes[0].nodeValue;
      }
    }
    return out;
  }

  function MakeLineChart(ykey, ytitle){
    //Width and height
    var margin = {top: 20, right: 20, bottom: 30, left: 100},
	    width = 800 - margin.left - margin.right,
	    height = 200 - margin.top - margin.bottom;

    var svg = d3.select("#" + ykey)
	    .attr("width", width + margin.left + margin.right)
	    .attr("height", height + margin.top + margin.bottom)
	    .append("g")
	    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    svg.append("g")
      .attr("class", "x axis")
      .style("font-size", "11px")
      .attr("transform", "translate(" + 0 + "," + height + ")");

    svg.append("g")
      .attr("class", "y axis")
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".80em")
      .style("text-anchor", "end")
      .style("font-size", "11px")
      .text(ytitle);

    Deps.autorun(function(){
	    var dataset = Points.find({},{sort:{date:-1}}).fetch();

      var x = d3.time.scale()
        .domain([
          d3.min(dataset, function(d) {return d.date;}),
          d3.max(dataset, function(d) {return d.date;})
        ])
	      .range([0, width]);

      var y = d3.scale.linear()
        .domain([
          d3.min(dataset, function(d) {return d[ykey];}),
          d3.max(dataset, function(d) {return d[ykey];})
        ])
	      .range([height, 0]);

      var xAxis = d3.svg.axis()
	      .scale(x)
	      .orient("bottom");

      var yAxis = d3.svg.axis()
	      .scale(y)
	      .orient("left");

      var line = d3.svg.line()
	      .x(function(d) {
		      return x(d.date);
	      })
	      .y(function(d) {
		      return y(d[ykey]);
	      });

	    var paths = svg.selectAll("path.line")
		    .data([dataset]); //todo - odd syntax here - should use a key function, but can't seem to get that working

	    //Update X axis
	    svg.select(".x.axis")
		    .call(xAxis);
		
	    //Update Y axis
	    svg.select(".y.axis")
		    .call(yAxis);
	
	    paths
		    .enter()
		    .append("path")
		    .attr("class", "line")
		    .attr('d', line);

	    paths
		    .attr('d', line); //todo - should be a transisition, but removed it due to absence of key
		
	    paths
		    .exit()
		    .remove();
    });
  }

  Template.home.data = function () {
    var point = Points.findOne();
    return point;
  };

  Template.home.events({
    // Catch the dropped event
    'dropped #dropzone': function(event, temp) {
      FS.Utility.eachFile(event, function(file) {
        Meteor.call("removeAllPoints");
        var r = new FileReader();
        r.onload = function(e) { 
  	      var contents = e.target.result;
          var parsed = new DOMParser().parseFromString(e.target.result, "text/xml");

          // company name
          var company = GetElementValue(parsed, "pfs-gcd:EntityCurrentLegalName", "CurrentDuration");
          
          // get the values
          var periode = GetElementValue(parsed, "pfs:PeriodEndDate", "CurrentInstant");
          var werknemers = GetElementValue(parsed, "pfs:EmployeesRecordedPersonnelRegisterTotalNumberClosingDate", "CurrentInstant");
          var vtes = GetElementValue(parsed, "pfs:EmployeesRecordedPersonnelRegisterAverageNumberEmployeesCalculatedFullTimeEquivalents", "CurrentDuration");
          var opl = GetElementValue(parsed, "pfs:OperatingProfitLoss", "CurrentDuration");
          Points.insert({
            "company": company,
            "date": moment(periode).toDate(), 
            "werknemers": parseInt(werknemers) || 0,
            "vtes": parseInt(vtes) || 0,
            "opl": parseFloat(opl) || 0
          })

          // get previous values
          var prev_periode = GetElementValue(parsed, "pfs:PeriodEndDate", "PrecedingInstant");
          if (prev_periode < 1)
            prev_periode = moment(periode).subtract(1, "days").format();
          var prev_werknemers = GetElementValue(parsed, "pfs:EmployeesRecordedPersonnelRegisterTotalNumberClosingDate", "PrecedingInstant");
          var prev_vtes = GetElementValue(parsed, "pfs:EmployeesRecordedPersonnelRegisterAverageNumberEmployeesCalculatedFullTimeEquivalents", "PrecedingDuration");
          var prev_opl = GetElementValue(parsed, "pfs:OperatingProfitLoss", "PrecedingDuration");
          Points.insert({
            "company": company,
            "date": moment(prev_periode).toDate(), 
            "werknemers": parseInt(prev_werknemers),
            "vtes": parseInt(prev_vtes),
            "opl": parseFloat(prev_opl)
          })
        }          
        r.readAsText(file);
        Nbb.insert(file, function (err, fileObj) {
          //If !err, we have inserted new doc with ID fileObj._id, and
          //kicked off the data upload using HTTP
        });
      });

      // hide the dropzone and show the reset button instead
      $(".explanation").hide();
      $(".dropzone").hide();
      $(".resetbutton").show();
      $(".charts").show();
      
    }
  });

  Template.home.events({
	  'click #resetbutton':function(){
      Meteor.call("removeAllPoints");

      // hide the reset button and show the dropzone instead
      $(".charts").hide();
      $(".resetbutton").hide();
      $(".dropzone").show();

	  }
  });


  Template.werknemers.rendered = function(){
    MakeLineChart("werknemers", "Aantal werknemers");
  }

  Template.opl.rendered = function(){
    MakeLineChart("opl", "Operating Profit/Loss");
  }

}


if (Meteor.isServer) {

  Meteor.startup(
    function(){
      Points.remove({});
    }
  )

  Meteor.methods({
    'removeAllPoints': function(){
		  Points.remove({});
    }
  });

}
