#include "common/mysql_helper.js"


var DESCRIPTION="This advisor identifies all tables with MyISAM storage engine from the information_schema,"
                " which is not a recommended 'crash-safe' type of storage engine.";
var query1= "SELECT table_schema, table_name, engine"
       " FROM information_schema.tables"
       " WHERE table_schema NOT IN ('mysql', 'INFORMATION_SCHEMA',"
       " 'performance_schema', 'ndbinfo') AND engine = 'MyISAM'";
       
var query2="SELECT count(table_name)"
           " FROM information_schema.tables"
           " WHERE table_schema "
           "NOT IN ('mysql', 'INFORMATION_SCHEMA','performance_schema', 'ndbinfo')";

var MAX_TABLES=4096;
var ANALYZE_ALL_HOSTS=false;

function main()
{
    var hosts     = cluster::mySqlNodes();
    var advisorMap = {};
    /* We will only run the query on one galera node 
     * so we will create only one advice.
     */
     
    var advice = new CmonAdvice();
    advice.setTitle("Checking for MyISAM Tables");


    cmonConfig       = conf::values();

    var exists = cmonConfig.keys().contains("enable_is_queries");    
    if (exists) 
        if (!cmonConfig["enable_is_queries"].toBoolean())
        {
            advice.setHost(hosts[0]);
            advice.setAdvice("Nothing to do.");
            advice.setSeverity(Ok);
            advice.setJustification("Information_schema queries are not enabled.");
            advisorMap[0]= advice;
            return advisorMap;
        }
    
    for (idx = 0; idx < hosts.size(); idx++)
    {
        host        = hosts[idx];
        map         = host.toMap();
        connected   = map["connected"];
        var msg ="";
        
        if (!connected)
            continue;
        
        print("   ");
        print(host);
        print("==========================");
        advice.setHost(host);    
        var tableCount = getSingleValue(host, query2);

        if (tableCount.toInt() > MAX_TABLES)
        {
            advice.setAdvice("Nothing to do.");
            advice.setSeverity(Ok);
            advice.setJustification("Too many tables to analyze"
                                    " using information_schema.");
            print(advice.toString("%E"));
            advisorMap[idx]= advice;
            if (ANALYZE_ALL_HOSTS)
                continue;
            return advisorMap;
        }
        
        ret = getValueMap(host, query1);
        if(ret == false || ret.size() == 0)
        {
            advice.setAdvice("Nothing to do. There are no MYISAM tables.");
            advice.setSeverity(Ok);
            advice.setJustification("No MYISAM table has been detected.");
            advisorMap[idx]= advice;
            print(advice.toString("%E"));
            if(host.nodeType() == "galera")
                host.clearAlarm(StorageMyIsam);

            if (ANALYZE_ALL_HOSTS)
                continue;
            return advisorMap;
        }

        justification = "The tables: '";
        print("<table>");
        print("<tr><td width=20%>Table Name</td>"
              "<td width=20%>Schema</td>"
              "<td width=20%>Engine</td>"
              "<td width=40%>Recommendation</td></tr>");

        for(i=0; i<ret.size(); ++i)
        {
            print("<tr><td width=20%>" + ret[i][0] + "</td>"
                  "<td width=20%>" + ret[i][1] + "</td>"
                  "<td width=20%>" + ret[i][2] + "</td>"
                  "<td width=40%>Change to ENGINE = INNODB if possible.</td></tr>");
        }
        print("</table><br/>");
        for(i=0; i<ret.size(); ++i)
        {
            justification = justification +  " " + ret[i][0]  + "." + ret[i][1];
        }
        justification = justification + "' are MYISAM tables.";
        advice.setAdvice("Change engine to InnoDB.");
        advice.setSeverity(Warning);
        advice.setJustification(justification);
        print(advice.toString("%E"));
        advisorMap[idx]= advice;
        alarmMsg = justification + " You are recommended to change ENGINE to INNODB.";
        if(host.nodeType() == "galera")
           host.raiseAlarm(StorageMyIsam, Warning, alarmMsg);
        if (ANALYZE_ALL_HOSTS)
            continue;
        break;
    }
    return advisorMap;
}


