// const GODOT_CONFIG = { "args": [], "canvasResizePolicy": 2, "executable": "index", "experimentalVK": false, "focusCanvas": true, "gdnativeLibs": [] };
// var engine = new Engine(GODOT_CONFIG);

// var ws_port = "{{ ws_port }}";
// var ws_ip = "{{ ws_ip }}";
// var sio_namespace = "{{ sio_namespace }}";

var godotSocket;
var callbackGodot;


function initGodotSocket(ws_ip, ws_port, sio_namespace) {
    godotSocket = io.connect('http://' + ws_ip + ':' + ws_port + sio_namespace);
    godotSocket.on('connect', function () {
        console.log('godot socket connects')
        //godotSocket.emit('browserConnect', JSON.stringify({'session_id': "{{ session_id }}"}));
        godotSocket.emit('godotConnect', JSON.stringify({ 'session_id': window.appsessionId }));

    });

    godotSocket.on('godotIncMessage', async (message) => {
        callbackGodot(JSON.stringify(message));
    });
}

function initCallBack(callback) {
    callbackGodot = callback;	// initialize callback to godot.
}

function disconnectGodotSocket() {
    godotSocket.disconnect()
}

function sendMessageFromGodot(data, func, fossbot_name, user_id) {
    godotSocket.emit("godotMessage", { "data": data, "function": func, "fossbot_name": fossbot_name, "user_id": user_id });
}

function sendErrorFromGodot(data, fossbot_name, user_id) {
    godotSocket.emit("godotError", { "data": data, "fossbot_name": fossbot_name, "user_id": user_id });
}

function sendEnvMessageFromGodot(data, user_id) {
    godotSocket.emit("godotMessage", { "data": data, "user_id": user_id });
}

(function () {
    const INDETERMINATE_STATUS_STEP_MS = 100;
    var statusProgress = document.getElementById('status-progress');
    var statusProgressInner = document.getElementById('status-progress-inner');
    var statusIndeterminate = document.getElementById('status-indeterminate');
    var statusNotice = document.getElementById('status-notice');

    var initializing = true;
    var statusMode = 'hidden';

    var animationCallbacks = [];
    function animate(time) {
        animationCallbacks.forEach(callback => callback(time));
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);

    function setStatusMode(mode) {

        if (statusMode === mode || !initializing)
            return;
        [statusProgress, statusIndeterminate, statusNotice].forEach(elem => {
            elem.style.display = 'none';
        });
        animationCallbacks = animationCallbacks.filter(function (value) {
            return (value != animateStatusIndeterminate);
        });
        switch (mode) {
            case 'progress':
                statusProgress.style.display = 'block';
                break;
            case 'indeterminate':
                statusIndeterminate.style.display = 'block';
                animationCallbacks.push(animateStatusIndeterminate);
                break;
            case 'notice':
                statusNotice.style.display = 'block';
                break;
            case 'hidden':
                break;
            default:
                throw new Error('Invalid status mode');
        }
        statusMode = mode;
    }

    function animateStatusIndeterminate(ms) {
        var i = Math.floor(ms / INDETERMINATE_STATUS_STEP_MS % 8);
        if (statusIndeterminate.children[i].style.borderTopColor == '') {
            Array.prototype.slice.call(statusIndeterminate.children).forEach(child => {
                child.style.borderTopColor = '';
            });
            statusIndeterminate.children[i].style.borderTopColor = '#dfdfdf';
        }
    }

    function setStatusNotice(text) {
        while (statusNotice.lastChild) {
            statusNotice.removeChild(statusNotice.lastChild);
        }
        var lines = text.split('\n');
        lines.forEach((line) => {
            statusNotice.appendChild(document.createTextNode(line));
            statusNotice.appendChild(document.createElement('br'));
        });
    };

    function displayFailureNotice(err) {
        var msg = err.message || err;
        console.error(msg);
        setStatusNotice(msg);
        setStatusMode('notice');
        initializing = false;
    };

    // if (!Engine.isWebGLAvailable()) {
    //     displayFailureNotice('WebGL not available');
    // } else {
    //     setStatusMode('indeterminate');
    //     engine.startGame({
    //         'onProgress': function (current, total) {
    //             if (total > 0) {
    //                 statusProgressInner.style.width = current / total * 100 + '%';
    //                 setStatusMode('progress');
    //                 if (current === total) {
    //                     // wait for progress bar animation
    //                     setTimeout(() => {
    //                         setStatusMode('indeterminate');
    //                     }, 500);
    //                 }
    //             } else {
    //                 setStatusMode('indeterminate');
    //             }
    //         },
    //     }).then(() => {
    //         setStatusMode('hidden');
    //         initializing = false;
    //     }, displayFailureNotice);
    // }
})();