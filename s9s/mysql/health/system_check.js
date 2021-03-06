#include "common/mysql_helper.js"
#include "cmon/alarms.h"

/**
 * Functionality test  if the mysql server is working properly (and responding)
 * by executing DDL (testing meta data locks) and DML.
 * CREATE DATABASE IF NOT EXISTS s9s_cmon;
 * CREATE TABLE s9s_cmon.s9s_dummy(a integer primary key auto_increment, char(255));
 * INSERT INTO s9s_cmon.s9s_dummy(b) VALUES('test1'),('test2');
 * SELECT * FROM s9s_cmon.s9s_dummy;
 * DROP TABLE IF NOT EXITS s9s_cmon.s9s_dummy;
 */

var DESCRIPTION="This advisor is a Health Check which executes a series of queries to test DDL (metadata locks) and"
                " DML and notifies you if the check fails, which could indicate that although the server may be up the database may not be responding correctly.";
var TITLE = "System Health Check - v0.1";

/* This script takes an argument
 *
 * To raise an alarm, schedule this with 'true' as the single argument.
 */
function main(raiseAlarmOnFail)
{
    var hosts     = cluster::mySqlNodes();
    var advisorMap = {};
    var commands = {};
    /* lets make sure we start with a clean slate*/
    commands[0] = "CREATE DATABASE IF NOT EXISTS s9s_cmon";
    commands[1] = "CREATE TABLE IF NOT EXISTS s9s_cmon.s9s_dummy"
        "(a integer primary key auto_increment, b char(255))";
    commands[2] = "INSERT INTO s9s_cmon.s9s_dummy(b)"
        " VALUES('test1'),('test2')";
    commands[3] = "SELECT * FROM s9s_cmon.s9s_dummy";
    commands[4] = "DROP TABLE IF EXISTS s9s_cmon.s9s_dummy";

    var raiseAlarm = false;

    if (!raiseAlarmOnFail.empty())
        raiseAlarm = raiseAlarmOnFail.toBoolean();

    for (idx = 0; idx < hosts.size(); idx++)
    {

        var advice = new CmonAdvice();
        advice.setTitle("System Check");
        host        = hosts[idx];
        if (!host.connected())
        {
            continue;
        }
        var checkOk = true;
        host.executeSqlCommand("SET SQL_LOG_BIN=0");
        for(i = 0; i < commands.size(); ++i)
        {
            if (commands[i].toString().contains("SELECT"))
                retval = host.executeSqlQuery(commands[i]);
            else
                retval = host.executeSqlCommand(commands[i]);
            if (!retval["success"])
            {
                advice.setSeverity(Critical);
                msg="Failed to execute:<b> " + commands[i] + ": " +
                    retval["errorMessage"] + "</b>";

                print(host, ":", msg);
                advice.setJustification(msg);
                advice.setAdvice("Health check failed: " + (commands.size() - i) +
                                 "/" + commands.size() + " tests failed.");
                checkOk = false;
                if (raiseAlarm)
                {
                    alarmMsg = "The System Check failed:<br/>" + msg + ". ";
                    host.raiseAlarm(ClusterSystemCheck, Critical, alarmMsg);
                }
                break;
            }
        }

        host.executeSqlCommand("SET SQL_LOG_BIN=1");

        if (checkOk)
        {
            advice.setSeverity(Ok);
            msg="Databases and tables can be created, written, and read.";
            print(host, ":", msg);
            advice.setJustification(msg);
            advice.setAdvice("Health check " + commands.size()  + "/" +
                             commands.size() + " tests succeeded.");
            retval= host.clearAlarm(ClusterSystemCheck);
            print(retval);
        }

        advice.setHost(host);
        advice.setTitle(TITLE);
        advisorMap[idx]= advice;
    }

    return advisorMap;
}



