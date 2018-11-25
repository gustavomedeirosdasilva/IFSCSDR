var socket = io();

var central_frequency;
var range;

window.addEventListener('resize',
    function(e) {
        clearCanvasFFT();
        drawGridFFT();
        drawFFT();
        drawWaterfall();
    }
);

var audioCtx = null;
window.onload = function() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtx.sampleRate = 44100;
    }
}


var bandwidth_input = document.getElementById('bandwidth_input');

bandwidth_input.addEventListener('change',
    function () {
        bandwidth_input_value = parseInt(bandwidth_input.value, 10);
        if (bandwidth_input_value <= range) {
            bandwidth = bandwidth_input_value;
            socket.emit('change_settings', {'bandwidth': bandwidth});
        } else {
            bandwidth_input.value = bandwidth;
        }
    }
);

var frequency_input = document.getElementById('frequency_input');

frequency_input.addEventListener('change',
    function () {
        var frequency_input_value = parseInt(frequency_input.value, 10);
        if (frequency_input_value >= central_frequency - range/2 && frequency_input_value <= central_frequency + range/2) {
            frequency = frequency_input_value;
            socket.emit('change_settings', {'frequency': frequency});
        } else {
            frequency_input.value = frequency;
        }
    }
);

var demodulation_type = document.getElementById('demodulation_type');

demodulation_type.addEventListener('change',
    function () {
        var settings = {'demodulation_type': demodulation_type.value}
        switch (demodulation_type.value) {
            case 'wfm':
                settings.bandwidth = 200000;
                bandwidth = 200000;
                break;
            case 'nfm':
                settings.bandwidth = 10000;
                bandwidth = 10000;
                break;
            case 'am':
                settings.bandwidth = 10000;
                bandwidth = 10000;
                break;
            case 'usb':
                settings.bandwidth = 10000;
                bandwidth = 10000;
                break;
            case 'lsb':
                settings.bandwidth = 10000;
                bandwidth = 10000;
                break;
        }
        bandwidth_input.value = bandwidth;
        socket.emit('change_settings', settings);
    }
);


var sdr_devices = document.getElementById('sdr_devices');
sdr_devices.addEventListener('change',
    function () {
        console.log('VALUE: ', sdr_devices.value);

        var settings = {'device': sdr_devices.value};
        socket.emit('change_settings', settings);
    }
);


////////////////////////////////////////
// WebSocket Logic.
////////////////////////////////////////
socket.on('connect',
    function() {
        console.log('Client has connected to the server!');
        socket.emit('fft_frequency_range');
    }
);

var frequency;
var bandwidth;
socket.on('fft_frequency_range',
    function (data) {
        if (sdr_devices.length == 0) {
            for (var device of data.devices) {
                var option = document.createElement('option');
                option.text = device;
                sdr_devices.add(option);
            }
        }

        central_frequency = data.central_frequency;
        range = data.range;

        frequency = central_frequency;

        demodulation_type.value = data.demodulator;

        switch (demodulation_type.value) {
            case 'wfm':
                bandwidth = 200000;
                break;
            case 'nfm':
                bandwidth = 10000;
                break;
            case 'am':
                bandwidth = 10000;
                break;
            case 'usb':
                bandwidth = 10000;
                break;
            case 'lsb':
                bandwidth = 10000;
                break;
        }

        frequency_input.value = frequency;
        bandwidth_input.value = bandwidth;

        var settings = {'demodulation_type': demodulation_type.value, 'frequency': frequency, 'bandwidth': bandwidth};
        socket.emit('change_settings', settings);
        enableFFTTimer();
    }
);

socket.on('fft_data',
    function (data) {
        fft_data = data;
        clearCanvasFFT();
        drawGridFFT();
        drawFFT();
        drawWaterfall();
    }
);

socket.on('audio_data',
    function (data) {
        var audio = data2audio(data);
        Array.prototype.push.apply(audio_buffer, audio);

        if (!audio_buffer_timer) {
            enableAudioBufferTimer();
        }

    }
);

socket.on('disconnect',
    function() {
        console.log('The client has disconnected!');

        clearCanvasFFT();
        drawGridFFT();
        drawNoDataAvailable();
        disableFFTTimer();

        socket = io();
    }
);


////////////////////////////////////////
// Audio Logic.
////////////////////////////////////////
var audio_gain = document.getElementById("audio_gain");
audio_gain.value = 1;

var audio_buffer = [];


function data2audio(data) {
    var data = new DataView(data);
    var audio16 = new Int16Array(Math.ceil(data.byteLength / Int16Array.BYTES_PER_ELEMENT)-1);

    for (var i = 0; i < audio16.length; i++) {
        audio16[i] = data.getInt16(i*Int16Array.BYTES_PER_ELEMENT, true);
    }

    var audio32 = new Array(audio16.length);

    for (var i = 0; i < audio16.length; i++) {
        var normalized = audio16[i] / 32768;
        audio32[i] = normalized;
    }

    return audio32;
}

function playAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtx.sampleRate = 44100;
    }

    var scriptNode = audioCtx.createScriptProcessor(1024, 0, 1);

    scriptNode.onaudioprocess = function(audioProcessingEvent) {
        var outputBuffer = audioProcessingEvent.outputBuffer;
        var outputData = outputBuffer.getChannelData(0);
        var audio_buffer_playing = audio_buffer.splice(0, outputData.length);

        for (var sample = 0; sample < outputData.length; sample++) {
            if (audio_buffer_playing[sample]) {
                outputData[sample] = audio_gain.value*audio_buffer_playing[sample];
            }
        }
    }

    scriptNode.connect(audioCtx.destination);
}


////////////////////////////////////////
// Canvas Logic.
////////////////////////////////////////
var fft_canvas = document.getElementById("fft_canvas");
fft_canvas.style.backgroundColor = '#1f1d1d';

var fft_canvas_ctx = fft_canvas.getContext("2d");
fft_canvas_ctx.canvas.width  = window.innerWidth*0.8;
fft_canvas_ctx.canvas.height = window.innerHeight*0.35;

function clearCanvasFFT() {
    fft_canvas_ctx.beginPath();
    fft_canvas_ctx.clearRect(0, 0, fft_canvas.width, fft_canvas.height);
}

function drawGridFFT() {
    fft_canvas_ctx.canvas.width  = window.innerWidth*0.8;
    fft_canvas_ctx.canvas.height = window.innerHeight*0.35;

    for (y = 0; y > -140; y -= 20) {
        fft_canvas_ctx.moveTo(fft_canvas.height/4, dB2canvas(y));
        fft_canvas_ctx.lineTo(fft_canvas.width, dB2canvas(y));
        drawDBText(y + ' dB', fft_canvas.height/4, dB2canvas(y));
    }

    var positions = getFreqGridPositions(9);
    for (var i = 0; i < 9; i++) {
        fft_canvas_ctx.moveTo(positions[i].canvas_point, 0);
        fft_canvas_ctx.lineTo(positions[i].canvas_point, fft_canvas.height - fft_canvas.height/16);
        var freq_in_mhz = parseFloat((positions[i].freq / 1000000).toFixed(4));
        drawFreqText(freq_in_mhz + ' MHz', positions[i].canvas_point, fft_canvas.height - fft_canvas.height/16);
    }

    fft_canvas_ctx.setLineDash([2, 5]);
    fft_canvas_ctx.lineWidth = 0.5;
    fft_canvas_ctx.strokeStyle = '#ffffff';
    fft_canvas_ctx.stroke();
}


function getFreqGridPositions(number_of_positions) {
    var positions = [];

    var freq_0 = central_frequency_zoom - range_zoom/2;
    var freq_1 = central_frequency_zoom + range_zoom/2;

    var freq = freq_0 - range_zoom/(2*number_of_positions);
    for (var i = 0; i < number_of_positions; i++) {

        freq += range_zoom/number_of_positions;

        var canvas_point = (freq - freq_0)/(freq_1 - freq_0)*fft_canvas.width;
        positions.push({'freq': freq, 'canvas_point': canvas_point});
    }

    return positions;
}

var zoom = document.getElementById("zoom");
zoom.value = 1;

var central_frequency_zoom;
var last_central_frequency;
var range_zoom;
var last_zoom_level = 0;
var zoom_0, zoom_1;

var fft_data = [];
function drawFFT() {
    if (fft_data) {
        if (last_zoom_level != zoom.value) {
            last_zoom_level = zoom.value;

            range_zoom = range/zoom.value;
            central_frequency_zoom = central_frequency - (central_frequency - frequency)*((zoom.value-1)/zoom.value);

            var selector_position_fft_point = freq2fft_point(frequency);
            zoom_0 = selector_position_fft_point - Math.round(selector_position_fft_point/zoom.value);
            zoom_1 = selector_position_fft_point + Math.round((fft_data.length - selector_position_fft_point)/zoom.value);
        } else if (central_frequency != last_central_frequency) {
            central_frequency_zoom = central_frequency - (central_frequency - frequency)*((zoom.value-1)/zoom.value);
            last_central_frequency = central_frequency;
            zoom.value = 1;
        }

        fft_canvas_ctx.beginPath();
        var relation = fft_canvas.width / fft_data.length*zoom.value;
        for (var x = 0, y = zoom_0; y < zoom_1; x += relation, y += 1) {
            fft_canvas_ctx.moveTo(x, dB2canvas(fft_data[y]));
            fft_canvas_ctx.lineTo(x+relation, dB2canvas(fft_data[y+1]));
        }
        fft_canvas_ctx.setLineDash([]);
        fft_canvas_ctx.lineWidth = 0.7;
        fft_canvas_ctx.strokeStyle = '#ffffff';
        fft_canvas_ctx.stroke();
        drawSelector();
        drawFreqDBMousePosition(db_mouse_position, freq_mouse_position);
    } else {
        drawNoDataAvailable();
    }
}


function drawNoDataAvailable() {
    fft_canvas_ctx.font = fft_canvas.width/20 + 'px Arial';
    fft_canvas_ctx.fillStyle = '#ffff00';
    fft_canvas_ctx.textAlign = 'center';
    fft_canvas_ctx.textBaseline = 'middle';
    fft_canvas_ctx.fillText('NO DATA AVAILABLE', fft_canvas.width/2, fft_canvas.height/2);
}

function dB2canvas(fft_point) {
    var dB_max = 5;
    var dB_min = -115;
    return ((fft_point - dB_max)*fft_canvas.height) / (dB_min - dB_max);
}

function canvas2dB(canvas_point) {
    var dB_max = 5;
    var dB_min = -115;
    return canvas_point*(dB_min - dB_max)/fft_canvas.height + dB_max;
}

function canvas2freq(canvas_point) {
    return Math.trunc((canvas_point/fft_canvas.width) * range_zoom + central_frequency_zoom - range_zoom/2);
}

function freq2canvas(freq) {
    return (freq - central_frequency_zoom + range_zoom/2)*(fft_canvas.width/range_zoom);
}

function canvas2fft_point(canvas_point) {
    return Math.trunc((canvas_point/fft_canvas.width) * (fft_data.length));
}

function fft_point2canvas(fft_point) {
    return (fft_point/fft_data.length) * (fft_canvas.width);
}

function fft_point2freq(fft_point) {
    var canvas_point = (fft_point/fft_data.length) * fft_canvas.width;
    return canvas2freq(canvas_point);
}

function freq2fft_point(freq) {
    var canvas_point = (freq - central_frequency_zoom + range_zoom/2)*(fft_canvas.width/range_zoom);
    return canvas2fft_point(canvas_point);
}


function drawDBText(text, x, y) {
    fft_canvas_ctx.font = fft_canvas.height/15 + 'px Arial';
    fft_canvas_ctx.fillStyle = '#ffff00';
    fft_canvas_ctx.textAlign = 'right';
    fft_canvas_ctx.textBaseline="middle";
    fft_canvas_ctx.fillText(text, x, y);
}

function drawFreqText(text, x, y) {
    fft_canvas_ctx.font = fft_canvas.height/15 + 'px Arial';
    fft_canvas_ctx.fillStyle = '#ffff00';
    fft_canvas_ctx.textAlign = 'center';
    fft_canvas_ctx.textBaseline= 'top';
    fft_canvas_ctx.fillText(text, x, y);
}

function drawFreqDBMousePosition(db, freq) {
    if (db != -1) {
        fft_canvas_ctx.font = fft_canvas.height/15 + 'px Arial';
        fft_canvas_ctx.fillStyle = '#ffff00';
        fft_canvas_ctx.textAlign = 'right';
        fft_canvas_ctx.textBaseline= 'top';
        fft_canvas_ctx.fillText(Math.round(db) + ' dB', fft_canvas.width - fft_canvas.width/100, fft_canvas.height/20);
        fft_canvas_ctx.fillText(freq + ' Hz', fft_canvas.width - fft_canvas.width/100, fft_canvas.height/10);
    }
}


fft_canvas.addEventListener("mousemove", changeCursorStyle, false);
fft_canvas.addEventListener("mouseleave", mouseleaveEvent, false);

function mouseleaveEvent() {
    document.body.style.cursor = "default";
    removeEventListeners();
    freq_mouse_position = -1;
    db_mouse_position = -1;
}

var selector_position;
var selector_width;
var freq_mouse_position = -1;
var db_mouse_position = -1;
function changeCursorStyle(e) {
    var pos = getMousePositionX(e);
    if (pos >= selector_position - 1 && pos <= selector_position + 1) {
        document.body.style.cursor = "ew-resize";
        fft_canvas.removeEventListener("mouseup", sendBandwidthAndFrequency, false);
        fft_canvas.removeEventListener("mousedown", changeSelectorPosition, false);
        fft_canvas.addEventListener("mousedown", addEventListenersSelectorPosition, false);
    } else if (pos >= selector_position + selector_width/2 - 3 && pos <= selector_position + selector_width/2) {
        document.body.style.cursor = "e-resize";
        fft_canvas.removeEventListener("mouseup", sendBandwidthAndFrequency, false);
        fft_canvas.removeEventListener("mousedown", changeSelectorPosition, false);
        fft_canvas.addEventListener("mousedown", addEventListenersSelectorWidthRight, false);
    } else if (pos <= selector_position - selector_width/2 + 3 && pos >= selector_position - selector_width/2) {
        document.body.style.cursor = "w-resize";
        fft_canvas.removeEventListener("mouseup", sendBandwidthAndFrequency, false);
        fft_canvas.removeEventListener("mousedown", changeSelectorPosition, false);
        fft_canvas.addEventListener("mousedown", addEventListenersSelectorWidthLeft, false);
    } else {
        document.body.style.cursor = "crosshair";
        fft_canvas.addEventListener("mouseup", sendBandwidthAndFrequency, false);
        fft_canvas.addEventListener("mousedown", changeSelectorPosition, false);

    }

    freq_mouse_position = canvas2freq(pos);
    pos = getMousePositionY(e);
    db_mouse_position = canvas2dB(pos);
}

function addEventListenersSelectorPosition(e) {
    fft_canvas.removeEventListener("mousemove", changeCursorStyle, false);
    fft_canvas.removeEventListener("mousemove", changeSelectorWidthRight, false);
    fft_canvas.removeEventListener("mousemove", changeSelectorWidthLeft, false);
    fft_canvas.addEventListener("mouseup", sendBandwidthAndFrequency, false);
    fft_canvas.addEventListener("mousemove", changeSelectorPosition, false);
}

function addEventListenersSelectorWidthRight(e) {
    fft_canvas.removeEventListener("mousemove", changeCursorStyle, false);
    fft_canvas.removeEventListener("mousemove", changeSelectorPosition, false);
    fft_canvas.removeEventListener("mousemove", changeSelectorWidthLeft, false);
    fft_canvas.addEventListener("mouseup", sendBandwidthAndFrequency, false);
    fft_canvas.addEventListener("mousemove", changeSelectorWidthRight, false);
}

function addEventListenersSelectorWidthLeft(e) {
    fft_canvas.removeEventListener("mousemove", changeCursorStyle, false);
    fft_canvas.removeEventListener("mousemove", changeSelectorWidthRight, false);
    fft_canvas.removeEventListener("mousemove", changeSelectorPosition, false);
    fft_canvas.addEventListener("mouseup", sendBandwidthAndFrequency, false);
    fft_canvas.addEventListener("mousemove", changeSelectorWidthLeft, false);
}

function removeEventListeners() {
    fft_canvas.removeEventListener("mouseup", sendBandwidthAndFrequency, false);
    fft_canvas.removeEventListener("mousemove", changeSelectorPosition, false);
    fft_canvas.removeEventListener("mousemove", changeSelectorWidthRight, false);
    fft_canvas.removeEventListener("mousemove", changeSelectorWidthLeft, false);
    fft_canvas.removeEventListener("mousedown", addEventListenersSelectorPosition, false);
    fft_canvas.removeEventListener("mousedown", addEventListenersSelectorWidthRight, false);
    fft_canvas.removeEventListener("mousedown", addEventListenersSelectorWidthLeft, false);
    fft_canvas.addEventListener("mousemove", changeCursorStyle, false);
}

function sendBandwidthAndFrequency() {
    removeEventListeners();
    frequency_input.value = frequency;
    bandwidth_input.value = bandwidth;
    socket.emit('change_settings', {'bandwidth': bandwidth, 'frequency': frequency});
}

function changeSelectorWidthRight(e) {
    var pos = getMousePositionX(e);
    var new_width = 2 * (pos - selector_position)
    if (new_width >= 3) {
        freq_mouse_position = canvas2freq(pos);
        pos = getMousePositionY(e);
        db_mouse_position = canvas2dB(pos);
        bandwidth = Math.abs(freq_mouse_position - frequency)*2;

        clearCanvasFFT();
        drawGridFFT();
        drawFFT();
    }
}

function changeSelectorWidthLeft(e) {
    var pos = getMousePositionX(e);
    var new_width = 2 * (selector_position - pos)
    if (new_width >= 3) {
        freq_mouse_position = canvas2freq(pos);
        pos = getMousePositionY(e);
        db_mouse_position = canvas2dB(pos);
        bandwidth = Math.abs(freq_mouse_position - frequency)*2;

        clearCanvasFFT();
        drawGridFFT();
        drawFFT();
    }
}

function changeSelectorPosition(e) {
    freq_mouse_position = canvas2freq(getMousePositionX(e));
    var pos = getMousePositionY(e);
    db_mouse_position = canvas2dB(pos);
    frequency = freq_mouse_position;

    clearCanvasFFT();
    drawGridFFT();
    drawFFT();
}

function getMousePositionX(e) {
    var rect = fft_canvas.getBoundingClientRect();
    return e.clientX - rect.left;
}

function getMousePositionY(e) {
    var rect = fft_canvas.getBoundingClientRect();
    return e.clientY - rect.top;
}


function drawSelector() {

    selector_position = freq2canvas(frequency);
    selector_width = bandwidth*fft_canvas.width/range_zoom;

    fft_canvas_ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
    fft_canvas_ctx.fillRect(selector_position - selector_width/2, 0, selector_width, fft_canvas.height);
    fft_canvas_ctx.fillStyle = 'rgba(255, 0, 0, 0.30)';
    fft_canvas_ctx.fillRect(selector_position - 1, 0, 3, fft_canvas.height);
}


var waterfall_canvas = document.getElementById("waterfall_canvas");
waterfall_canvas.style.backgroundColor = '#000010';

var waterfall_canvas_ctx = waterfall_canvas.getContext("2d");
waterfall_canvas.width  = window.innerWidth*0.8;
waterfall_canvas.height = window.innerHeight*0.35;

var waterfall_range_min = document.getElementById("waterfall_range_min");
waterfall_range_min.value = -75;

var waterfall_range_max = document.getElementById("waterfall_range_max");
waterfall_range_max.value = -15;

var waterfall_range_min_value = document.getElementById("waterfall_range_min_value");
waterfall_range_min_value.value = waterfall_range_min.value;

var waterfall_range_max_value = document.getElementById("waterfall_range_max_value");
waterfall_range_max_value.value = waterfall_range_max.value;

waterfall_canvas.addEventListener("mousemove", changeCursorStyleWaterfall, false);
waterfall_canvas.addEventListener("mouseleave", mouseleaveEvent, false);

function changeCursorStyleWaterfall() {
    document.body.style.cursor = "crosshair";
    waterfall_canvas.addEventListener("mouseup", sendBandwidthAndFrequency, false);
    waterfall_canvas.addEventListener("mousedown", changeSelectorPositionWaterfall, false);
}

function changeSelectorPositionWaterfall(e) {
    var rect = waterfall_canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;

    frequency = canvas2freq(x)

    clearCanvasFFT();
    drawGridFFT();
    drawFFT();
}


function getColorWaterfall(fft_point) {
    function waterfall_color_function(x, x1, x2, y1, y2) {
        return ((x - x1)/(x2 - x1))*(y2-y1) + y1;
    }

    var waterfall_color_0 = waterfall_range_min.value;
    var waterfall_color_1 = waterfall_range_max.value;

    var waterfall_color_0_0 = waterfall_color_0 - (waterfall_color_0 - waterfall_color_1)/4;
    var waterfall_color_0_1 = waterfall_color_0 - (waterfall_color_0 - waterfall_color_1)/2;

    if (fft_point < waterfall_color_0) {
        // Azul escuro.
        return '#000010';
    } else if (fft_point >= waterfall_color_0 && fft_point < waterfall_color_0_0) {
        // Gradiente do azul escuro para o azul mais claro.
        var i = Math.trunc(waterfall_color_function(fft_point, waterfall_color_0, waterfall_color_0_0, 10, 255));
        return 'rgb(0, 0, ' + i + ')';
    } else if (fft_point >= waterfall_color_0_0 && fft_point < waterfall_color_0_1) {
        // Gradiente do amarelo mais escuro para o amarelo mais claro.
        var i = Math.trunc(waterfall_color_function(fft_point, waterfall_color_0_0, waterfall_color_0_1, 145, 255));
        return 'rgb(' + i + ',' + i + ',0)';
    } else if (fft_point >= waterfall_color_0_1 && fft_point < waterfall_color_1) {
        // Gradiente de amarelo para vermelho.
        var i = Math.trunc(waterfall_color_function(fft_point, waterfall_color_0_1, waterfall_color_1, 255, 0));
        return 'rgb(255,' + i + ',0)';
    } else {
        // Vermelho.
        return '#ff0000'
    }
}


var waterfall_canvas_data;
var waterfall_width;
var waterfall_height;
function drawWaterfall() {
    waterfall_width = Math.trunc(window.innerWidth*0.8);
    waterfall_height = Math.trunc(window.innerHeight*0.35);
    if (waterfall_canvas.width != waterfall_width || waterfall_canvas_ctx.canvas.height != waterfall_height) {
        var waterfall_canvas_data = waterfall_canvas_ctx.getImageData(0, 0, waterfall_canvas.width, waterfall_canvas.height);

        var old_width = waterfall_canvas.width;
        var old_height = waterfall_canvas.height;

        waterfall_canvas.width  = waterfall_width;
        waterfall_canvas.height = waterfall_height;

        waterfall_canvas_ctx.putImageData(waterfall_canvas_data, 0, 0);
        waterfall_canvas_ctx.drawImage(waterfall_canvas_ctx.canvas, 0, 0, old_width, old_height, 0, 0, waterfall_canvas.width, waterfall_canvas.height);
    }

    if (fft_data) {
        var grd = waterfall_canvas_ctx.createLinearGradient(0, 0, waterfall_canvas.width, 0);
        for(var x = 0, y = zoom_0; y < zoom_1; x += 1/(zoom_1 - zoom_0), y += 1){
            grd.addColorStop(x, getColorWaterfall(fft_data[y]));
        }

        waterfall_canvas_ctx.fillStyle = grd;
        waterfall_canvas_ctx.fillRect(0, 0, waterfall_canvas.width, 1); 

        var waterfall_canvas_data = waterfall_canvas_ctx.getImageData(0, 0, waterfall_canvas.width, waterfall_canvas.height);
        waterfall_canvas_ctx.putImageData(waterfall_canvas_data, 0, 1);
        waterfall_canvas_ctx.drawImage(waterfall_canvas_ctx.canvas, 0, 0, waterfall_canvas.width, waterfall_canvas.height);
    }
}

function drawWaterfallPixel(x, y, rgb) {
    var index = (x + y * waterfall_canvas.width) * 4;

    waterfall_canvas_data.data[index + 0] = rgb[0];
    waterfall_canvas_data.data[index + 1] = rgb[1];
    waterfall_canvas_data.data[index + 2] = rgb[2];
    waterfall_canvas_data.data[index + 3] = 255;
}


////////////////////////////////////////
// Timer Logic.
////////////////////////////////////////
var fft_refresh_time = document.getElementById('fft_refresh_time');
fft_refresh_time.value = '350';

fft_refresh_time.addEventListener('change',
    function () {
        disableFFTTimer();
        enableFFTTimer();
    }
);

var fft_timer = null;
function enableFFTTimer() {
    fft_timer = setInterval(function() {
        socket.emit('fft_data');
    }, fft_refresh_time.value); // in ms.
}

function disableFFTTimer() {
    if (fft_timer) {
        clearInterval(fft_timer);
    }
}

var audio_buffer_timer = null;
var refresh_audio_buffer_time = 200; // in ms.

function enableAudioBufferTimer() {
    audio_buffer_timer = setInterval(function() {
        playAudio();
        disableAudioBufferTimer();
    }, refresh_audio_buffer_time);
}

function disableAudioBufferTimer() {
    if (audio_buffer_timer) {
        clearInterval(audio_buffer_timer);
    }
}
