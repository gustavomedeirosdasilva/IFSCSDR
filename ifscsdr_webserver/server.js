const fs = require('fs');

const MAX_CLIENTS = 30;

const execSync = require('child_process').execSync;
const exec = require('child_process').exec;
del_dir();

process.on('uncaughtException',
    function (err) {
        console.log('uncaughtException: ' + err);
    }
);

const os = require('os-utils');

var allow_clients = true;

setInterval(function () {
    os.cpuUsage(
        function(pcpu) {
            var pmem = os.freememPercentage();

            if (pcpu >= 0.8 || pmem <= 0.2) {
                console.log('CPU Usage: ' + pcpu + '  MEM FREE: ' + pmem);
                if (clients.length > 0) {
                    clients[0].socket.disconnect();
                }
                allow_clients = false;
            } else {
                allow_clients = true;
            }
        }
    );
}, 1000);


////////////////////////////////////////
// HTTP server.
////////////////////////////////////////
const express = require('express');
const app = express();
const sha512 = require('js-sha512').sha512;
const bodyParser = require('body-parser');
const session = require('express-session');

app.use(session({
    secret: 'IFSCSDR',
    resave: true,
    saveUninitialized: true
}));

app.use(bodyParser.urlencoded({
    extended: true
}));


// Authentication and Authorization Middleware
var auth = function(req, res, next) {
    if (req.session && req.session.is_logged && req.session.admin) {
        return next();
    } else {
        return res.sendStatus(401);
    }
};


function build_config_page(user) {
    var page = '<html> <head> <link rel=\'shortcut icon\' href=\'favicon.png\'/> <title>IFSCSDR</title> </head> <body> <center> <div id="logo" style="position: relative; overflow: hidden; width: 80%"> <div id="ifscsdr" style="position: relative; width: 50%; float: left;"> <img src="logo_ifscsj.png" style="width: 250px; height: 90px;"> </div> <div id="ifscsdr" style="position: relative; width: 40%; float: left;"> <img src="logo_ifscsdr.png" style="width: 250px ;height: 90px;"> </div> <div id="config" style="position: relative; width: 10%; float: left;"> <p id="text" style="position: absolute;"> <a href="logout">Logout</a> </p> </div> </div>';

    page += '<div style="position: relative; overflow: hidden; width: 100%">' +
        '<form action="/user_config" method="post" id="user_config">' +
        '<table border="0">' +
            '<tr><td><br><td></tr>' +
            '<tr>' +
                '<td>User:</td> <td>' +  user + '<input type="hidden" name="user" value="' + user + '"></td>' +
            '</tr>' +
            '<tr>' +
                '<td>Password:</td> <td><input type="password" name="password"></td>' +
            '</tr>' +
            '<tr><td><br><td></tr>' +
            '<tr>' +
                '<td></td> <td><input type="submit" value="Change"></td>' +
            '</tr>' +
            '<tr><td><br><td></tr>' +
        '</table>' +
        '</form>' +
    '</div>'

    for (var device_server of devices_server) {
        page += '<div style="position: relative; overflow: hidden; width: 100%">' +
            '<form action="/device_config" method="post" id="device_config_' + device_server.device + '">' +
            '<table border="0">' +
                '<tr><td><br><td></tr>' +
                '<tr>' +
                    '<td>Serial:</td> <td>' +  device_server.device + '<input type="hidden" name="serial" value="'
                     + device_server.device + '"></td>' +
                '</tr>' +
                '<tr>' +
                    '<td>Frequency:</td> <td><input type="text" name="center_freq" value="' + device_server.center_freq + '"></td>' +
                '</tr>' +
                '<tr>' +
                    '<td>Sample Rate:</td> <td><input type="text" name="sample_rate" value="' + device_server.sample_rate + '"></td>' +
                '</tr>' +
                '<tr>' +
                    '<td>Gain:</td> <td><input type="text" name="gain" value="' + device_server.gain + '"></td>' +
                '</tr>' +
                '<tr>' +
                    '<td>Correction frequency:</td> <td><input type="text" name="freq_correction" value="' + device_server.freq_correction + '"></td>' +
                '</tr>' +
                '<tr>' +
                    '<td>Up converter freq.:</td> <td><input type="text" name="up_converter" value="' + device_server.up_converter + '"></td>' +
                '</tr>' +
                '<tr>' +
                    '<td>Demodulator:</td> <td>' +
                    '<select name="demodulator" form="device_config_' + device_server.device + '">' +
                        '<option ' + (device_server.demodulator == 'am'  ? 'selected' : '') + ' value="am">AM</option>' +
                        '<option ' + (device_server.demodulator == 'wfm' ? 'selected' : '') + ' value="wfm">WFM</option>' +
                        '<option ' + (device_server.demodulator == 'nfm' ? 'selected' : '') + ' value="nfm">NFM</option>' +
                        '<option ' + (device_server.demodulator == 'usb' ? 'selected' : '') + ' value="usb">USB</option>' +
                        '<option ' + (device_server.demodulator == 'lsb' ? 'selected' : '') + ' value="lsb">LSB</option>' +
                        '</select></td>' +

                '</tr>' +
                '<tr><td><br><td></tr>' +
                '<tr>' +
                    '<td></td> <td><input type="submit" value="Change"></td>' +
                '</tr>' +
                '<tr><td><br><td></tr>' +
            '</table>' +
            '</form>' +
        '</div>'
    }

    if (devices_server.length == 0) {
        page += '<br><br><br>There is not device connected!'
    }

    page += '</center> </body> </html>'

    return page;
}

// Login endpoint
app.post('/login', function (req, res) {
    if (!req.body.username || !req.body.password) {
        res.send('<html><head><meta http-equiv="refresh" content="2; URL=/"></head><body>Failed</body></html>');
        return;
    }

    var users = JSON.parse(fs.readFileSync(__dirname + '/users.json', 'utf8'));
    if (!users) {
        res.send('<html><head><meta http-equiv="refresh" content="2; URL=/"></head><body>Failed</body></html>');
        return;
    }

    var user = users.find(obj => obj.user === req.body.username);
    if (!user) {
        res.send('<html><head><meta http-equiv="refresh" content="2; URL=/"></head><body>Failed</body></html>');
        return;
    }

    passwd_sha512 = sha512(req.body.password)
    if (passwd_sha512 === user.passwd_sha512) {
        req.session.user = user.user;
        req.session.admin = true;
        req.session.is_logged = true;
        res.send(build_config_page(user.user));
    } else {
        req.session.admin = false;
        req.session.is_logged = false;
        res.send('<html><head><meta http-equiv="refresh" content="2; URL=/"></head><body>Failed</body></html>');
    }
});

// Logout endpoint
app.get('/logout', function (req, res) {
    if (req.session.is_logged != true) {
        res.send('<html><head><meta http-equiv="refresh" content="2; URL=/"></head><body>Failed</body></html>');
        return;
    }

    req.session.destroy();
    res.send('<html><head><meta http-equiv="refresh" content="2; URL=/"></head><body>Logout success</body></html>');
});

// Get login page
app.get('/login', function (req, res) {
    if (req.session.is_logged != true) {
        res.sendFile('/public/login.html', {root: __dirname });
    } else {
        res.send(build_config_page(req.session.user));
    }
});

app.get('/config', function (req, res) {
    if (req.session.is_logged != true) {
        res.send('<html><head><meta http-equiv="refresh" content="2; URL=/"></head><body>Failed</body></html>');
        return;
    }

    res.send(build_config_page(req.session.user));
});

app.post('/device_config', function (req, res) {
    if (req.session.is_logged != true) {
        res.send('<html><head><meta http-equiv="refresh" content="2; URL=/"></head><body>Failed</body></html>');
        return;
    }

    center_freq = Number(req.body.center_freq);
    sample_rate = Number(req.body.sample_rate);
    freq_correction = Number(req.body.freq_correction);
    up_converter = Number(req.body.up_converter);

    if (isNaN(center_freq) || isNaN(sample_rate) || isNaN(freq_correction) || isNaN(up_converter)) {
        res.send('<html><head><meta http-equiv="refresh" content="2; url=/config"></head><body>Invalid settings!</body></html>');
        return;
    }

    var devices_settings = JSON.parse(fs.readFileSync(__dirname + '/devices.json', 'utf8'));
    if (!devices_settings) {
        fs.writeFileSync(__dirname + '/devices.json', JSON.stringify([req.body], null, 4), 'utf8');
    }

    var device = devices_settings.find(obj => obj.serial === req.body.serial);
    if (device) {
        device.center_freq = center_freq;
        device.sample_rate = sample_rate;
        device.gain = req.body.gain;
        device.freq_correction = freq_correction;
        device.up_converter = up_converter;
        device.demodulator = req.body.demodulator;
    } else {
        devices_settings.push(req.body);
    }

    fs.writeFileSync(__dirname + '/devices.json', JSON.stringify(devices_settings, null, 4), 'utf8');

    var device = devices_server.find(obj => obj.device === req.body.serial);
    if (device) {
        device.center_freq = center_freq;
        device.sample_rate = sample_rate;
        device.gain = req.body.gain;
        device.freq_correction = freq_correction;
        device.up_converter = up_converter;
        device.demodulator = req.body.demodulator;

        device.apply_new_settings();

        for (var socket of device.web_clients) {
            try {
                socket.emit('fft_frequency_range', {
                    'central_frequency': device.center_freq - device.up_converter,
                    'range': device.sample_rate,
                    'demodulator': device.demodulator,
                });
            } catch (err) {
            }
        }

    }

    res.send('<html><head><meta http-equiv="refresh" content="2; url=/config"></head><body>Settings saved successfully</body></html>');
});


app.post('/user_config', function (req, res) {
    if (req.session.is_logged != true) {
        res.send('<html><head><meta http-equiv="refresh" content="2; URL=/"></head><body>Failed</body></html>');
        return;
    }

    var users = JSON.parse(fs.readFileSync(__dirname + '/users.json', 'utf8'));
    if (!users) {
        res.send('<html><head><meta http-equiv="refresh" content="2; url=/config">User file settings not found!</head><body></body></html>');
    }

    var user = users.find(obj => obj.user === req.body.user);
    if (user) {
        user.passwd_sha512 = sha512(req.body.password);
        fs.writeFileSync(__dirname + '/users.json', JSON.stringify(users, null, 4), 'utf8');
        res.send('<html><head><meta http-equiv="refresh" content="2; url=/config"></head><body>Settings saved successfully</body></html>');
    } else {
        res.send('<html><head><meta http-equiv="refresh" content="2; url=/config"></head><body>User not found!</body></html>');
    }
});


const web_server = require('http').createServer(app);
const io = require('socket.io')(web_server);
const port = 80;

web_server.listen(port, function () {
    console.log('Web Server listening at port ' + port);
});

// Routing
app.use(express.static(__dirname + '/public'));

var clients = [];
// WebSocket
io.on('connect',
    function (socket) {
        remote = socket.request.connection._peername;
        console.log('WEBSOCKET SERVER CONNECTED: (' + socket.id + ') ' + remote.address + ':' + remote.port);

        if (!allow_clients || clients.length >= MAX_CLIENTS) {
            socket.disconnect();
        }

        var client = {'socket': socket, 'spawn_demodulator': null}
        clients.push(client);
        socket.ifscsdr_client = client;

        socket.on('fft_frequency_range',
            function (data) {
                var devices_serial = [];
                for (var device_server of devices_server) {
                    devices_serial.push(device_server.device);
                }

                socket.ifscsdr_client.device_server = devices_server[0];
                socket.ifscsdr_client.device_server.add_webclient(socket);
                try {
                    socket.emit('fft_frequency_range', {
                        'central_frequency': devices_server[0].center_freq - devices_server[0].up_converter,
                        'range': devices_server[0].sample_rate,
                        'demodulator': devices_server[0].demodulator,
                        'devices': devices_serial
                    });
                } catch (err) {
                }
            }
        );

        socket.on('fft_data',
            function (data) {
                try {
                    socket.emit('fft_data', socket.ifscsdr_client.device_server.fft_points[socket.ifscsdr_client.device_server.last_fft_points_position]);
                } catch (err) {
                }
            }
        );

        socket.on('change_settings',
            function (data) {
                if (data.device) {
                    if (data.device == socket.ifscsdr_client.device_server.device) {
                        return;
                    }

                    var devices_serial = [];
                    for (var device_server of devices_server) {
                        devices_serial.push(device_server.serial);
                    }

                    var device = devices_server.find(obj => obj.device === data.device);
                    socket.ifscsdr_client.device_server.rm_webclient(socket);
                    socket.ifscsdr_client.device_server = device;
                    socket.ifscsdr_client.device_server.add_webclient(socket);
                    try {
                        socket.emit('fft_frequency_range', {
                            'central_frequency': device.center_freq - device.up_converter,
                            'range': device.sample_rate,
                            'demodulator': device.demodulator,
                            'devices': devices_serial
                        });
                    } catch (err) {
                    }
                }

                if (data.frequency) {
                    if (socket.ifscsdr_client.frequency != data.frequency + socket.ifscsdr_client.device_server.up_converter) {
                        socket.ifscsdr_client.frequency = data.frequency + socket.ifscsdr_client.device_server.up_converter;
                        change_shift_addition_cc(socket.ifscsdr_client);
                    }
                }

                if (data.bandwidth) {
                    if (socket.ifscsdr_client.bandwidth != data.bandwidth) {
                        socket.ifscsdr_client.bandwidth = data.bandwidth;
                        change_bandpass_fir_fft_cc(socket.ifscsdr_client);
                    }
                }

                if (data.demodulation_type) {
                    if (data.demodulation_type != socket.ifscsdr_client.demodulation_type) {
                        socket.ifscsdr_client.demodulation_type = data.demodulation_type;
                        deleteDemodulator(socket.ifscsdr_client);
                        createDemodulator(socket.ifscsdr_client);
                    }
                }
            }
        );

        // Used when the socket closes.
        socket.on('disconnect',
            function (data) {
                console.log('WEBSOCKET SERVER DISCONNECT: (' + socket.id + ') ' + remote.address + ':' + remote.port);

                var client = clients.find(obj => obj.socket === socket);
                if (client) {
                    var index = clients.indexOf(client);
                    clients.splice(index, 1);
                    del_client(client);
                    deleteDemodulator(client);
                    delete client;
                }

                try {
                    socket.ifscsdr_client.device_server.rm_webclient(socket);
                } catch (err) {
                }
            }
        );
    }
);


////////////////////////////////////////
// Socket server. SDR connection.
////////////////////////////////////////
const net = require('net');
const socket_sdr_server = net.createServer();

const spawn = require('child_process').spawn;

const socket_sdr_server_port = 5000;
socket_sdr_server.listen(socket_sdr_server_port, '0.0.0.0');

const dgram = require('dgram');

class IFSCSDRDeviceServer {
    constructor(client_ip, device, tcp_socket) {
        this.device = device;
        this.tcp_socket = tcp_socket;
        this.port = 33333;
        this.fft_size = 1024;
        this.client_ip = client_ip;
        this.web_clients = [];
        this.loadSettings();
        this.createConvertU8FFT();
        this.createServer();
    }

    loadSettings() {
        var devices_settings = JSON.parse(fs.readFileSync(__dirname + '/devices.json', 'utf8'));
        if (!devices_settings) {
            return;
        }

        var device = devices_settings.find(obj => obj.serial === this.device);
        if (device) {
            this.center_freq = device.center_freq;
            this.sample_rate = device.sample_rate;
            this.gain = device.gain;
            this.freq_correction = device.freq_correction;
            this.demodulator = device.demodulator;
            this.up_converter = device.up_converter;
        } else {
            console.log('Device ' + server.IFSCSDRDeviceServer.device + ' not found in devices.json.');
            this.center_freq = 100e6;
            this.sample_rate = 2.88e6;
            this.gain = 'auto';
            this.freq_correction = 30;
            this.demodulator = 'wfm';
            this.up_converter = 0;
        }

        this.transmit = false;
    }

    createServer() {
        let server = dgram.createSocket('udp4');

        server.on('listening', function () {
            let address = server.address();
            console.log('UDP Server listening on ' + address.address + ":" + address.port);
            var device_settings = {
                'devices_settings': [{
                    'serial': server.IFSCSDRDeviceServer.device,
                    'transmit': server.IFSCSDRDeviceServer.transmit,
                    'port': server.IFSCSDRDeviceServer.port,
                    'sample_rate': server.IFSCSDRDeviceServer.sample_rate,
                    'center_freq': server.IFSCSDRDeviceServer.center_freq,
                    'gain': server.IFSCSDRDeviceServer.auto,
                    'freq_correction': server.IFSCSDRDeviceServer.freq_correction
                }]
            };
            server.IFSCSDRDeviceServer.tcp_socket.write(JSON.stringify(device_settings));
        });

        server.on('message', function (message, remote) {
            server.IFSCSDRDeviceServer.convert_u8_f.stdin.write(message, 'a');
        });

        server.on('error', function (err) {
            console.log('ERROR: ' + err);
            this.IFSCSDRDeviceServer.port++;
            this.IFSCSDRDeviceServer.createServer();
        });

        server.bind(this.port, this.client_ip);
        server.IFSCSDRDeviceServer = this;
        this.server = server;
    }


    createConvertU8FFT() {
        this.convert_u8_f = spawn('csdr', ['convert_u8_f']);
        this.convert_u8_f.stdout.fft = spawn('bash', [__dirname + '/ifsc_sdr_cmd.sh', 'fft', this.sample_rate, this.fft_size]);

        let fft_points = [];
        let fft_points_position = 0;
        let last_fft_points_position = 1;

        this.fft_points = fft_points;
        this.fft_points_position = fft_points_position;
        this.last_fft_points_position = last_fft_points_position;

        this.convert_u8_f.stdout.fft.stdout.on('data',
            function (data) {
                var arr_float = [];
                for(var i = 0; i + 3 < data.length; i += 4)
                    arr_float.push(data.readFloatLE(i));

                fft_points[fft_points_position] = arr_float;

                last_fft_points_position = fft_points_position;
                if (fft_points_position == 0) fft_points_position = 1;
                else fft_points_position = 0;
            }
        );

        this.convert_u8_f.stdout.on('data',
            function (data) {
                this.fft.stdin.write(data);
                for (var i = 0; i < clients.length; i++) {
                    if (clients[i].spawn_demodulator_is_ready) {
                    try {
                        clients[i].spawn_demodulator.stdin.write(data);
                    } catch (err) {
                    }
                }
                }
            }
        );
    }

    add_webclient(client_socket) {
        this.web_clients.push(client_socket);
        this.transmit_enable();
    }

    rm_webclient(client_socket) {
        var client = this.web_clients.find(obj => obj.id === client_socket.id);
        if (client) {
            var index = this.web_clients.indexOf(client);
            this.web_clients.splice(index, 1);
        }
        if (this.web_clients.length == 0) {
            this.transmit_disable();
        }
    }

    close() {
        this.server.close();
    }

    transmit_enable() {
        this.transmit = true;
        var device_settings = {'devices_settings': [{'serial': this.device, 'transmit': true}]};
        this.tcp_socket.write(JSON.stringify(device_settings));
    }

    transmit_disable() {
        this.transmit = false;
        var device_settings = {'devices_settings': [{'serial': this.device, 'transmit': false}]};
        this.tcp_socket.write(JSON.stringify(device_settings));
    }

    apply_new_settings() {
        var device_settings = {
                'devices_settings': [{
                    'serial': this.device,
                    'sample_rate': this.sample_rate,
                    'center_freq': this.center_freq,
                    'gain': this.auto,
                    'freq_correction': this.freq_correction
                }]
            };
        this.tcp_socket.write(JSON.stringify(device_settings));
    }
}

var devices_server = [];

socket_sdr_server.on('listening',
    function (e) {
        console.log('Socket SDR Server listening at port ' + socket_sdr_server_port);
    }
);

socket_sdr_server.on('error',
    function (e) {
        console.log('Socket SDR Server error at port ' + socket_sdr_server_port + ': ' + e);
        console.log('Exiting...');
        process.exit();
    }
);

socket_sdr_server.on('connection',
    function(socket) {
        console.log('SOCKET SDR SERVER CONNECTED: ' + socket.remoteAddress +':'+ socket.remotePort);

        socket.on('data',
            function(data) {
                devices = JSON.parse(data);
                if (devices == null) {
                    return;
                }

                if ('devices' in devices) {
                    for (var device of devices.devices) {
                        console.log('DEVICES: ', device);
                        server = new IFSCSDRDeviceServer('0.0.0.0', device, socket);
                        devices_server.push(server);
                    }
                } else if ('device_add' in devices) {
                    console.log('DEVICE ADDED: ', devices.device_add);
                    server = new IFSCSDRDeviceServer('0.0.0.0', devices.device_add, socket);
                    devices_server.push(server);
                } else if ('device_rem' in devices) {
                    console.log('DEVICE REMOVED: ', devices.device_rem);
                    var device = devices_server.find(obj => obj.device === devices.device_rem);
                    if (device) {
                        var index = devices_server.indexOf(device);
                        devices_server.splice(index, 1);
                        device.close();
                        delete device;
                    }
                }
            }
        );

        socket.on('close',
            function(data) {
                fft_points[last_fft_points_position] = null;
                console.log('SOCKET SERVER CLOSED: ' + socket.remoteAddress + ' ' + socket.remotePort);
                convert_u8_f.stdin.write('');
            }
        );
    }
);

function createDemodulator(client) {
    del_client(client);
    new_client(client);

    var demodulator;
    switch (client.demodulation_type) {
        case 'wfm':
            demodulator = 'wfm_demodulator';
            if (!client.bandwidth) client.bandwidth = 200000;
            if (!client.frequency) client.frequency = client.device_server.center_freq;
            change_shift_addition_cc(client);
            change_bandpass_fir_fft_cc(client);
            break;

        case 'nfm':
            demodulator = 'nfm_demodulator';
            if (!client.bandwidth) client.bandwidth = 10000;
            if (!client.frequency) client.frequency = client.device_server.center_freq;
            change_shift_addition_cc(client);
            change_bandpass_fir_fft_cc(client);
            break;

        case 'am':
            demodulator = 'am_demodulator';
            if (!client.bandwidth) client.bandwidth = 10000;
            if (!client.frequency) client.frequency = client.device_server.center_freq;
            change_shift_addition_cc(client);
            change_bandpass_fir_fft_cc(client);
            break;

        case 'usb':
            demodulator = 'usb_demodulator';
            if (!client.bandwidth) client.bandwidth = 10000;
            if (!client.frequency) client.frequency = client.device_server.center_freq;
            change_shift_addition_cc(client);
            change_bandpass_fir_fft_cc(client);
            break;

        case 'lsb':
            demodulator = 'lsb_demodulator';
            if (!client.bandwidth) client.bandwidth = 10000;
            if (!client.frequency) client.frequency = client.device_server.center_freq;
            change_shift_addition_cc(client);
            change_bandpass_fir_fft_cc(client);
            break;

        default:
            client.spawn_demodulator = null;
            return;
    }


    client.spawn_demodulator_is_ready = false;

    client.spawn_demodulator = spawn('bash', [__dirname + '/ifsc_sdr_cmd.sh', demodulator, client.socket.id, client.device_server.center_freq, client.frequency, client.device_server.sample_rate], {detached: true});

    client.spawn_demodulator.stdout.on('data',
        function (data) {
            try {
                client.socket.emit('audio_data', data);
            } catch (err) {
                console.log('client.socket.emit err: ' + err);
            }
        }
    );

    client.spawn_demodulator_is_ready = true;
}

function deleteDemodulator(client) {
    client.spawn_demodulator_is_ready = false;
    if (client.spawn_demodulator) {
        try {
            client.spawn_demodulator.stdin.end();
            client.spawn_demodulator.kill();
            //process.kill(-client.spawn_demodulator.pid);
            //process.kill(client.spawn_demodulator.pid);
            delete client.spawn_demodulator;
            client.spawn_demodulator = null;
        } catch (err) {
        }
    }
}


////////////////////////////////////////
// Others commands.
////////////////////////////////////////

function del_dir() {
    try {
        execSync('bash ' + __dirname + '/ifsc_sdr_cmd.sh del_dir ');
    } catch (err) {
    }
}

function new_client(client) {
    try {
        execSync('bash ' + __dirname + '/ifsc_sdr_cmd.sh new_client ' + client.socket.id);
    } catch (err) {
    }
}

function del_client(client) {
    try {
        execSync('bash ' + __dirname + '/ifsc_sdr_cmd.sh del_client ' + client.socket.id);
    } catch (err) {
    }
}

function change_shift_addition_cc(client) {
    var rate = (client.device_server.center_freq - client.frequency) / client.device_server.sample_rate;

    exec('bash ' + __dirname + '/ifsc_sdr_cmd.sh change_shift_addition_cc ' + client.socket.id + ' ' + rate,
        function (e, stdout, stderr) { }
    );
}

function change_bandpass_fir_fft_cc(client) {
    var high_cut = (client.bandwidth/2) / (client.device_server.sample_rate/20);
    var low_cut = -high_cut;

    exec('bash ' + __dirname + '/ifsc_sdr_cmd.sh change_bandpass_fir_fft_cc ' + client.socket.id + ' ' + low_cut + ' ' + high_cut ,
        function (e, stdout, stderr) { }
    );
}
