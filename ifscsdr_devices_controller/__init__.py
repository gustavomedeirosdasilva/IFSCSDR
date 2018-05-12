#!/usr/bin/env python3

import json
import os
from ifscsdr_client import IFSCSDRClient

if __name__ == '__main__':
    path = os.path.dirname(os.path.abspath( __file__ ))
    config_file = path + '/config.json'
    default_server = '127.0.0.1'
    default_port = 5000

    data = None
    try:
        with open(config_file) as f:
            data = json.loads(f.read())
    except:
        None

    server = None
    port = None
    if type(data) is dict:
        if 'server' in data:
            server = data['server']
        else:
            server = default_server

        if 'port' in data:
            port = data['port']
        else:
            port = default_port
    else:
        server = default_server
        port = default_port

    print('Server: ', server)
    print('Port: ', port)

    client = IFSCSDRClient(server, port)
    client.runStateMachine()
