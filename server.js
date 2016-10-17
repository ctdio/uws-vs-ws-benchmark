let args = require('argly').createParser({
    '--port': 'number',
    '--wsType': 'string',
    '--expectedMessages': 'number'
}).parse();


let wsType = (args.wsType === 'ws' || args.wsType === 'uws') && args.wsType;
let wsImpl;

try {
    wsImpl = require(wsType);
} catch (err) {
    throw new Error('Invalid websocket implemenatation provided');
}

let port = args.port || 8000;
let expectedMessages = args.expectedMessages;
let messageCount = 0;

let wss = new wsImpl.Server({port}, () => {
    if (process.send) {
        process.send('online');
    }
});

wss.on('connection', (socket) => {
    process.send({
        type: 'connection'
    });
    socket.on('message', (msg) => {
        messageCount++;
        process.send({
            type: 'msgReceived'
        });
        if (expectedMessages === messageCount) {
            console.log('complete');
            process.send({
                type: 'complete'
            });
        }
        socket.send(msg);
    });
    socket.send('emssage');
});

wss.on('error', (err) => {
    console.log('error', err);
    process.send({
        type: 'error',
        msg: err
    });
    process.exit(1);
});

process.on('message', (msg) => {
    if (msg === 'close') {
        process.exit();
    }
});

process.on('exit', () => {
    wss.close();
});
