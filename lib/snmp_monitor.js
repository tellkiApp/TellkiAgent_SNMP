/**
* This script was developed by Guberni and is part of Tellki's Monitoring Solution
*
* February, 2015
* 
* Version 1.0
*
* DEPENDENCIES:
*		net-snmp v1.1.13 (https://www.npmjs.com/package/net-snmp)
*
* DESCRIPTION: Monitor SNMP utilization
*
* SYNTAX: node snmp_monitor.js <HOST> <COMMUNITY> <METRIC_STATE> <METRICS> <PORT>
* 
* EXAMPLE: node "snmp_monitor.js" "192.168.69.8" "public" "1" "1127,4,"m1","1.3.6.1.2.1.43.11.1.1.9.1.1",0" "161"
*
* README:
*		<HOST> Hostname or ip address to check
* 
*		<COMMUNITY> SNMP community
*
*		<METRIC_STATE> is generated internally by Tellki and it's only used by Tellki default monitors.
*		1 - metric is on ; 0 - metric is off
*
*		<METRICS> custom metrics list, separated by ";" and each one have 5 fields separeted by "," and it contains the metric definition.
*
*		<PORT> SNMP port
**/

var snmp = require("net-snmp");


// ############# INPUT ###################################
//START
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


/*
* Verify number of passed arguments into the script.
*/
function monitorInput(args)
{

	if(args.length != 5)
	{
		throw new InvalidParametersNumberError();
	}		

	monitorInputProcess(args);
}


/*
* Process the passed arguments and send them to monitor execution (monitorICMP)
* Receive: arguments to be processed
*/
function monitorInputProcess(args)
{
	var cleanArgs = [];
	
	for (var k = 0; k < args.length; k++)
	{
		cleanArgs.push(args[k].replace(/\"/g, ""));
	}
	
	//<HOST> 
	var hostname = args[0];
	
	//<COMMUNITY> 
	var comunity = args[1];
	
	//<METRIC_STATE> 
	var metricState = cleanArgs[2].split(",");
	
	//<METRICS> 
	var metrics = cleanArgs[3].split(";");
	
	//<PORT>
	var port = args[4];
	
	//create snmp target object
	var monitorTarget = new Object();
	monitorTarget.hostname = hostname;
	monitorTarget.comunity = comunity;
	monitorTarget.port = port;
	
	
	
	//create metrics to retrieve
	var metricsToMonitor = [];
	
	for (var j = 0; j < metrics.length; j++)
	{
		var metricparam = metrics[j].split(",");
		
		var metricID = metricparam[0];
		var metricType = metricparam[1];
		var metricName = metricparam[2];
		var metricOID = metricparam[3].replace(/\"/g, "");
		
		var enable = metricState[j] === "1";
		
		var monitorMetric = new Object();
		monitorMetric.metricID = metricID;
		monitorMetric.metricType = metricType;
		monitorMetric.metricOID = metricOID;
		monitorMetric.enable = enable;
		monitorMetric.metricValue = "";
		monitorMetric.metricName = metricName;
		
		metricsToMonitor.push(monitorMetric);
	}
	
	//call monitor
	monitorSNMP(monitorTarget, metricsToMonitor);
}



// ################# SNMP ###########################

/*
* Retrieve metrics information
* Receive: 
* - snmp target configuration
* - metrics list 
*/
function monitorSNMP(monitorTarget, metricsToMonitor) 
{
	// create oids list
	var oids = [];
	
	for(var i = 0; i < metricsToMonitor.length; i++)
	{
		oids.push(metricsToMonitor[i].metricOID);
	}
	
	//set snmp options 
	var options = {
		port: monitorTarget.port,
		version: snmp.Version1
	};
	
	//create session
	var session = snmp.createSession (monitorTarget.hostname, monitorTarget.comunity, options);

	//do request
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
			if(varbinds.length === 0)
			{
				var e = new MetricNotFoundError();
				e.message = "Unable to collect metric "+ metricsToMonitor[i].metricName;
				errorHandler(e);
			}
		
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
			errorHandler(new RequestTimedOutError());
		}
		else
		{
			errorHandler(err)
		}
	});
}


/*
* Test on SNMP version 2.
* Receive: 
* - oids list
* - snmp target configuration
* - metrics list
*/
function callSNMP_V2(oids, monitorTarget, metricsToMonitor)
{
	//set snmp options 
	var options = {
		port: monitorTarget.port,
		version: snmp.Version2c
	};
	
	//create session
	var session = snmp.createSession (monitorTarget.hostname, monitorTarget.comunity, options);

	//do request
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
				errorHandler(new RequestTimedOutError());
			}
			else
			{
				errorHandler(error);
			}
		} 
		else 
		{
			if(varbinds.length === 0)
			{
				var e = new MetricNotFoundError();
				e.message = "Unable to collect metric "+ metricsToMonitor[i].metricName;
				errorHandler(e);
			}
			
			for (var i = 0; i < varbinds.length; i++)
			{
				if (snmp.isVarbindError (varbinds[i]))
				{
					metricsToMonitor[i].metricValue = snmp.varbindError (varbinds[i]);
				}
				else
				{
					metricsToMonitor[i].metricValue = ""+varbinds[i].value;
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
			errorHandler(new RequestTimedOutError());	
		}
		else
		{
			errorHandler(err);
		}
	});
	
}



//################### OUTPUT METRICS ###########################
/*
* Send metrics to console
* Receive: metrics list to output
*/
function output(metrics)
{
	var out = "";
	
	for(var i in metrics)
	{
		var metric = metrics[i];
		
		if(metric.enable)
		{
			out += metric.metricID+":"+metric.metricName+":"+metric.metricType;
			out += "|";
			out += metric.metricValue;
			out += "|";
				
			if(i < metrics.length-1)
			{
				out += "\n";
			}
		}
	}
	
	console.log(out);
}


//################### ERROR HANDLER #########################
/*
* Used to handle errors of async functions
* Receive: Error/Exception
*/
function errorHandler(err)
{
	if(err instanceof RequestTimedOutError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if(err instanceof InvalidOIDFormatError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if(err instanceof MetricNotFoundError)
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


//####################### EXCEPTIONS ################################

//All exceptions used in script

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = "Wrong number of parameters.";
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;


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


function MetricNotFoundError() {
    this.name = "MetricNotFoundError";
    this.message = "";
	this.code = 8;
}
MetricNotFoundError.prototype = Object.create(Error.prototype);
MetricNotFoundError.prototype.constructor = MetricNotFoundError;


