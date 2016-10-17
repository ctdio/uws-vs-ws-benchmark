let args = require('argly').createParser({
    '--testType': 'string',
    '--uri': 'string',
    '--wsType': 'string',
    '--connections': 'number',
    '--messages': 'number',
    '--msgSize': 'number'
}).parse();

let {uri, wsType, connections, messages} = args;
let wsImpl;

if (wsType) {
    wsImpl = require('ws');
} else {
    console.log(wsType);
    throw new Error('ws type not recognized, use either ws or uws');
}

let testType = args.testType;

let buffer = new Buffer(args.msgSize || 1000);
let totalMessages = args.messages;
let messagesSent = 0;

function connectAndSend() {
    let websocket = new wsImpl('ws://localhost:8000');
    websocket.on('open', () => {
        process.send({
            type: 'connection'
        });
        websocket.send(buffer);
    });

    if (testType !== 'connection') {
        websocket.on('message', (msg) => {
            process.send({
                type: 'msg',
                msg
            });
            websocket.send(buffer);
        });
    }

    websocket.on('error', (err) => {
        websocket.close();
        connectAndSend();
    });
}

process.on('message', (msg) => {
    if (msg === 'start') {
        for(let i = 0; i < connections; i++) {
            connectAndSend();
        }
    }
});
