onmessage = function (event) {
    console.log("Received message from the main thread:", event.data);
    postMessage('message received')
}