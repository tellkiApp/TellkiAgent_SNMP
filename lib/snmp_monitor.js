
//node snmp-monitor.js 1.1.1.1 1438 "" "1,1" "1094,9,\"m1\",\"1.1.1.1\",\"0|1\",0;1095,4,\"m2\",\"1.1.1.2\",\"\",0" 161

var snmp = require("net-snmp");

var statusId = "36:9";
var responseTimeId = "112:4";

//####################### EXCEPTIONS ################################

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = ("Wrong number of parameters.");
}
InvalidParametersNumberError.prototype = Error.prototype;

function InvalidMetricStateError() {
    this.name = "InvalidMetricStateError";
    this.message = ("Metrics and Status length not match");
}
InvalidMetricStateError.prototype = Error.prototype;

function InvalidMetricsError() {
    this.name = "InvalidMetricsError";
    this.message = ("Metric input format invalid.");
}
InvalidMetricsError.prototype = Error.prototype;


function InvalidMetricValueError() {
    this.name = "InvalidMetricValueError";
    this.message = "";
}
InvalidMetricValueError.prototype = Error.prototype;


// ############# INPUT ###################################

(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		console.log(err.message);
		process.exit(1);
	}
}).call(this)



function monitorInput(args)
{
	//args = ["","1438","public","1,1","1094,9,\"m1\",\"1.3.6.1.2.1.1.1.0\",\"*|*\",0;1095,4,\"m2\",\"1.3.6.1.2.1.1.2.0\",\"\",0","161"];
	
	if(args.length != 6)
	{
		throw new InvalidParametersNumberError()
	}		

	monitorInputProcess(args);
}



function monitorInputProcess(args)
{
	var cleanArgs = [];
	
	for (var k = 0; k < args.length; k++)
	{
		cleanArgs.push(args[k].replace(/\"/g, ""));
	}
	
	//host
	var hostname = args[0];
	
	//targetId
	var targetId = args[1];
	
	//comunity
	var comunity = args[2];
	
	//port
	var port = args[5];
	
	var monitorTarget = new Object();
	monitorTarget.hostname = hostname;
	monitorTarget.targetId = targetId;
	monitorTarget.comunity = comunity;
	monitorTarget.port = port;
	
	
	//metrics
	var metrics = cleanArgs[4].split(";");
	var metricState = cleanArgs[3].split(",");
	
	var metricsToMonitor = [];
	
	if (metrics.length == 0)
	{
		throw new InvalidMetricsError();
	}
	else if (metrics.length != metricState.length)
	{
		throw new InvalidMetricStateError();
	}
	else
	{
		for (var j = 0; j < metrics.length; j++)
		{
			var metricparam = metrics[j].split(",");
			
			if (metricparam.length != 6)
			{
				throw new InvalidMetricsError();
			}
			
			var metricID = metricparam[0];
			var metricType = metricparam[1];
			var metricOID = metricparam[3].replace(/\"/g, "");
			var metricDS = metricparam[4];
			// String metricObject = metricparam[5]; // Ignore for now.
			var enable = metricState[j] === "1";

			var binaryUpValue = "";
			var binaryDownValue = "";

			var values = metricDS.replace(/\"/g, "").trim();

			if (values.length > 0)
			{
				var tokens = values.split("|");
				
				binaryDownValue = tokens[0];
				binaryUpValue = tokens[1];
			}
			
			
			var monitorMetric = new Object();
			monitorMetric.metricID = metricID;
			monitorMetric.metricType = metricType;
			monitorMetric.metricOID = metricOID;
			monitorMetric.binaryDownValue = binaryDownValue;
			monitorMetric.binaryUpValue = binaryUpValue;
			monitorMetric.enable = enable;
			monitorMetric.metricValue = "";
			
			metricsToMonitor.push(monitorMetric);
		}
	}
	
	monitorSNMP(monitorTarget, metricsToMonitor);
}




//################### OUTPUT ###########################

function output(metrics, targetId)
{
	var out = "";
	
	for(var i in metrics)
	{
		var metric = metrics[i];
		
		if(metric.enable)
		{
			if(metric.metricType === "9")
			{
				
				if (metric.binaryDownValue === "*" || metric.binaryUpValue === "*" 
					|| metric.metricValue === metric.binaryDownValue || metric.metricValue === metric.binaryUpValue)
				{
					out += new Date().toISOString();
					out += "|";
					out += metric.metricID+":"+metric.metricType;
					out += "|";
					out += targetId;
					out += "|";
					out += metric.metricValue
					out += "\n";
				}
				else
				{
					var error = new InvalidMetricValueError()
					error.message = "Metric value is not valid! expected " + metric.metricType;
					errorHandler(error);
				}
			}
			else
			{
				out += new Date().toISOString();
				out += "|";
				out += metric.metricID+":"+metric.metricType;
				out += "|";
				out += targetId;
				out += "|";
				out += metric.metricValue
				out += "\n";
			}
		}
	}
	
	console.log(out);
}



function errorHandler(err)
{
	if(err.name === "RequestTimedOutError")
	{
		console.log("Timeout. Verify hostname/ipaddress and snmp settings.");	
	}
	else if(err.name === "InvalidMetricValueError")
	{
		console.log(err.message);	
	}
	else
	{
		console.log("Timeout. Verify hostname/ipaddress and snmp settings.");
	}
	
	process.exit(1);
}


// ################# MONITOR ###########################

function monitorSNMP(monitorTarget, metricsToMonitor) 
{
	var oids = [];
	
	for(var i = 0; i < metricsToMonitor.length; i++)
	{
		oids.push(metricsToMonitor[i].metricOID);
	}
	
	var options = {
		port: monitorTarget.port,
		version: snmp.Version1
	};
	
	
	var session = snmp.createSession (monitorTarget.host, monitorTarget.comunity, options);

	session.get (oids, function (error, varbinds) 
	{
	error = new Error();
		if (error) 
		{	
			callSNMP_V2(oids, monitorTarget, metricsToMonitor);	
		} 
		else 
		{
			for (var i = 0; i < varbinds.length; i++)
			{
				metricsToMonitor[i].metricValue = ""+varbinds[i].value;
			}

			output(metricsToMonitor, monitorTarget.targetId);
		}
		
		
		session.close();
				
	});
	
	session.on ("error", function(err)
	{
		session.close();
		errorHandler(err)
	});
}


function callSNMP_V2(oids, monitorTarget, metricsToMonitor)
{
	var options = {
		port: monitorTarget.port,
		version: snmp.Version2c
	};
	
	var session = snmp.createSession (monitorTarget.host, monitorTarget.comunity, options);

	session.get (oids, function (error, varbinds) 
	{
		if (error) 
		{
			errorHandler(error)
		} 
		else 
		{
			for (var i = 0; i < varbinds.length; i++)
			{
				if (snmp.isVarbindError (varbinds[i]))
				{
					metricsToMonitor[i].metricValue = snmp.varbindError (varbinds[i])
				}
				else
				{
					metricsToMonitor[i].metricValue = ""+varbinds[i].value
				}
			}
			
			output(metricsToMonitor, monitorTarget.targetId);
		}
		
		session.close();
	});
	
	session.on("error", function(err)
	{
		session.close();
		errorHandler(err)
	});
	
}




