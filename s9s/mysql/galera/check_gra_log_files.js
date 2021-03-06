#include "common/mysql_helper.js"

var DESCRIPTION="This advisor scans the MySQL data directory and notifies you"
                " if the GRA_*.log file exists. This file only appears if there"
                " is a failure or warning in your Galera replication.";
function main()
{
    var hosts     = cluster::mySqlNodes();
    var advisorMap = {};

    for (idx = 0; idx < hosts.size(); idx++)
    {
        host        = hosts[idx];
        map         = host.toMap();
        gStatus     = map["galera"]["galerastatus"];
        
        var msg ="";
        var advice = new CmonAdvice();
        advice.setTitle("GRA Log Checker");
        advice.setHost(host);
        justification = "";
        
        if (host.nodeType() != "galera")
            continue;

        var datadir = host.dataDir();
        if (datadir == "")
            continue;

        var retval = host.system("find " + datadir + 
                                 " -maxdepth 1 -name 'GRA_*.log' | wc -l");
        nr_files = retval["result"];
        
        if(nr_files.toInt() == 0) {
            msg = "Nothing to do. No GRA_*.log files found.";
            advice.setSeverity(Ok);
            justification = "Galera host does not have GRA_*.log files in the"
                            " MySQL data directory.";
        }
        else {
            justification = "Found " + nr_files +
                " GRA_*.log file(s) in the MySQL data directory (" + datadir +").";
            advice.setSeverity(Warning);
            msg = "The Galera host contains GRA_*.log files in the"
              " MySQL data directory. <br/>These GRA_*.log files are"
              " created whenever there is a replication failure. "
              "This could be because of any failure or warning in Galera to apply a"
              " certain transaction to the other nodes, e.g. replication"
              " deadlocks, huge transactions, or DDL changes to the same table."
              " For troubleshooting"
              " purposes these transactions are then logged inside these GRA log files."
              " Even if your application retries to apply the transaction on"
              " failure and ultimately succeeds these files are not removed."
             " <br/> See also"
              " <a href='https://www.percona.com/blog/2012/12/19/"
              "percona-xtradb-cluster-pxc-what-about-gra_-log-files/'"
              " target='_blank'>this blog post by Percona about this topic</a>."
              " <br/><br/> Galera doesn't clean up these files automatically,"
              " so you can remove them once they become too old. If you wish"
              " to be certain, you can examine the files and see what query"
              " causing the GRA log file to be created.";
        }
        advice.setAdvice(msg);
        advice.setJustification(justification);
        advisorMap[idx]= advice;
    }

    return advisorMap;
}

