
var snmp = require("net-snmp");


//####################### EXCEPTIONS ################################

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = "Wrong number of parameters.";
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;

function InvalidMetricStateError() {
    this.name = "InvalidMetricStateError";
    this.message = "Metrics and Status length not match";
	this.code = 9;
}
InvalidMetricStateError.prototype = Object.create(Error.prototype);
InvalidMetricStateError.prototype.constructor = InvalidMetricStateError;

function InvalidMetricsError() {
    this.name = "InvalidMetricsError";
    this.message = "Metric input format invalid.";
	this.code = 12;
}
InvalidMetricsError.prototype = Object.create(Error.prototype);
InvalidMetricsError.prototype.constructor = InvalidMetricsError;


function InvalidMetricValueError() {
    this.name = "InvalidMetricValueError";
    this.message = "";
	this.code = 13;
}
InvalidMetricValueError.prototype = Object.create(Error.prototype);
InvalidMetricValueError.prototype.constructor = InvalidMetricValueError;


function RequestTimedOutError() {
    this.name = "RequestTimedOutError";
    this.message = "Timeout. Verify hostname/ipaddress and snmp settings.";
	this.code = 14;
}
RequestTimedOutError.prototype = Object.create(Error.prototype);
RequestTimedOutError.prototype.constructor = RequestTimedOutError;


function InvalidOIDFormatError()
{
	this.name = "InvalidOIDFormatError";
    this.message = "Invalid OID format.";
	this.code = 25;
}
InvalidOIDFormatError.prototype = Object.create(Error.prototype);
InvalidOIDFormatError.prototype.constructor = InvalidOIDFormatError;

// ############# INPUT ###################################

(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		if(err instanceof InvalidParametersNumberError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidMetricStateError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidMetricsError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidMetricValueError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidOIDFormatError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else
		{
			console.log(err.message);
			process.exit(1);
		}
	}
}).call(this)



function monitorInput(args)
{

	if(args.length != 5)
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
	
	//comunity
	var comunity = args[1];
	
	//port
	var port = args[4];
	
	var monitorTarget = new Object();
	monitorTarget.hostname = hostname;
	monitorTarget.comunity = comunity;
	monitorTarget.port = port;
	
	
	//metrics
	var metrics = cleanArgs[3].split(";");
	var metricState = cleanArgs[2].split(",");
	
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
			var metricName = metricparam[2];
			var metricOID = metricparam[3].replace(/\"/g, "");
			var metricDS = metricparam[4];
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
			monitorMetric.metricName = metricName;
			
			metricsToMonitor.push(monitorMetric);
		}
	}
	
	monitorSNMP(monitorTarget, metricsToMonitor);
}




//################### OUTPUT ###########################

function output(metrics)
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
					out += metric.metricID+":"+metric.metricName+":"+metric.metricType;
					out += "|";
					out += metric.metricValue
					out += "|";
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
				out += metric.metricID+":"+metric.metricName+":"+metric.metricType;
				out += "|";
				out += metric.metricValue
				out += "|";
			}
			
			if(i < metrics.length-1)
			{
				out += "\n";
			}
		}
	}
	
	console.log(out);
}



function errorHandler(err)
{
	if(err instanceof RequestTimedOutError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if(err instanceof InvalidMetricValueError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if(err instanceof InvalidOIDFormatError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else
	{
		console.log(err.message);
		process.exit(1);
	}
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
	
	
	var session = snmp.createSession (monitorTarget.hostname, monitorTarget.comunity, options);

	session.get (oids, function (error, varbinds) 
	{
		if (error) 
		{	
			if(error.message.indexOf("is not a valid OID string") > -1)
			{
				errorHandler(new InvalidOIDFormatError());
			}
			
			callSNMP_V2(oids, monitorTarget, metricsToMonitor);	
		} 
		else 
		{
			for (var i = 0; i < varbinds.length; i++)
			{
				metricsToMonitor[i].metricValue = ""+varbinds[i].value;
			}

			output(metricsToMonitor);
		}
		
		
		session.close();
				
	});
	
	session.on ("error", function(err)
	{
	
		if(err.name === "RequestTimedOutError")
		{
			errorHandler(new RequestTimedOutError())	
		}
		else
		{
			errorHandler(err)
		}
	});
}


function callSNMP_V2(oids, monitorTarget, metricsToMonitor)
{
	var options = {
		port: monitorTarget.port,
		version: snmp.Version2c
	};
	
	var session = snmp.createSession (monitorTarget.hostname, monitorTarget.comunity, options);

	session.get (oids, function (error, varbinds) 
	{
		if (error) 
		{
			if(error.message.indexOf("is not a valid OID string") > -1)
			{
				errorHandler(new InvalidOIDFormatError());
			}
			else if(error.name === "RequestTimedOutError")
			{
				errorHandler(new RequestTimedOutError())	
			}
			else
			{
				errorHandler(error)
			}
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
			
			output(metricsToMonitor);
		}
		
		session.close();
	});
	
	session.on("error", function(err)
	{
		if(err.name === "RequestTimedOutError")
		{
			errorHandler(new RequestTimedOutError())	
		}
		else
		{
			errorHandler(err)
		}
	});
	
}




