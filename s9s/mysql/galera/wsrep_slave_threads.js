#include "common/mysql_helper.js"


var DESCRIPTION="This advisor reads the value of wsrep_slave_threads in runtime and"
" compares the value with the warning threshold and notifies you"
" if the slave thread is lower than 4 (a value that can be increased later depending on the workload).";
var WARNING_THRESHOLD=4;


function main()
{
    var hosts     = cluster::galeraNodes();
    var advisorMap = {};

    for (idx = 0; idx < hosts.size(); idx++)
    {
        host        = hosts[idx];
        map         = host.toMap();
        gStatus     = map["galera"]["galerastatus"];

        print("   ");
        print(host);
        print("==========================");

        if (gStatus!="Primary")
        {
            print("Is not Primary, continuing.");
            continue;
        }
        var msg = "";
        var justification = "";

        var advice = new CmonAdvice();
        advice.setTitle("Wsrep slave threads check");
        advice.setHost(host);
        var value = host.sqlSystemVariable("WSREP_SLAVE_THREADS");
        if (value.isError())
        {
            msg = "Not enough data to calculate";
            advice.setSeverity(Ok);
            advice.setJustification(msg);
            advice.setAdvice(msg);
            advisorMap[idx]= advice;
            continue;
        }

        if (value < WARNING_THRESHOLD)
        {
            msg="wsrep_slave_threads should be set to 4 or more."
            " 4 is a good start.";
            advice.setSeverity(1);
            justification = "wsrep_slave_threads <" + WARNING_THRESHOLD;
            advice.setJustification(justification);
        }
        else
        {
            msg = "wsrep_slave_threads is set to " + value + " and that is ok.";

            advice.setSeverity(0);
            justification="wsrep_slave_threads is greater"
            " than or equal to " + WARNING_THRESHOLD;
            advice.setJustification(justification);


        }
        advice.setAdvice(msg);
        advisorMap[idx]= advice;
        print(advice.toString("%E"));
    }
    return advisorMap;
}
