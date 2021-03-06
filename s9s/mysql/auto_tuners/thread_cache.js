#include "common/mysql_helper.js"

var DESCRIPTION="This advisor calculates the percentage of threads_created over threads_cached and"
                " adjust the thread_cache_size automatically based on the running workload.";
var UPPER_LIMIT=16384;
var INCREMENT = 256;
var DECREMENT =256;


function needsTuning(host, advice)
{
    if (checkPrecond(host))
    {
        var Threads_created1 = readStatusVariable(host, 
                                                  "Threads_created").toInt();
        mySleep(host,2);
        var Threads_created2 = readStatusVariable(host, 
                                                  "Threads_created").toInt();
        var Uptime = readStatusVariable(host, "Uptime").toInt();

        var Threads_cached = readStatusVariable(host,
                                                "Threads_cached").toInt();

        if (Threads_created1 == false ||
           Threads_cached == false ||
           Threads_created2 == false)
        {
            advise.setJustification("No data found");
        }
        else
        {
            if (Threads_created2 - Threads_created1 >= 2)
            {
                return true;
            }
            if (Threads_created2 / Uptime >= 2 && Threads_cached <= 1 )
            {
                return true;
            }
        }
    }
    return false;
}

function main()
{
    var hosts     = cluster::galeraNodes();
    var advisorMap = {};

    for (idx = 0; idx < hosts.size(); ++idx)
    {
        host        = hosts[idx];
        map         = host.toMap();
        connected     = map["connected"];
        var advice = new CmonAdvice();
        advice.setHost(host);
        advice.setTitle("Thread_cache_size auto-tuner.");
        if (connected)
        {
            if (needsTuning(host, advice))
            {
                var thread_cache_size = 
                    readVariable(host, "thread_cache_size").toInt();
                
                thread_cache_size=thread_cache_size + INCREMENT;
                if (thread_cache_size < UPPER_LIMIT)
                {
                    retval = setGlobalVariable(host,"table_open_cache", 
                                          table_open_cache);
                    if (retval["success"])
                    {
                        print(host.hostName() + ":" + host.port() + 
                              ": Increasing 'thread_cache_size' to " + 
                              thread_cache_size + ".");
                        var config      = host.config();
                        value = config.setVariable("MYSQLD", 
                                                   "thread_cache_size", 
                                                   thread_cache_size);

                        var retval = config.save();
                        if (!retval["success"])
                        {
                            print(host, ": Failed due to: " + retval["errorMessage"]);
                            advice.setAdvice("Failed due to: " + retval["errorMessage"]);
                        }
                        else
                        {
                            advice.setAdvice("Increased thread_cache_size=" + 
                                             value + 
                                             ".");
                        }
                        
                        advise.setJustification("Threads created exceeds"
                                                " the thread_cache size."
                                                " Tuning neeed.");
                    }
                    else
                    {
                        print(host, ": Failed due to: " + retval["errorMessage"]);
                        advice.setAdvice("Failed due to: " + retval["errorMessage"]);
                    }
                }
            }
            else
            {
                advice.setAdvice("No tuning needed.");
                advice.setJustification("No new threads have been created.");
            }
        }
        else
        {
             advice.setAdvice("Instance not connected.");
        }
        advice.setSeverity(0);
        advisorMap[idx]= advice;
        print(advice.toString("%E"));
    }
    return advisorMap;
}
