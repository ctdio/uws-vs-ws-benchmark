const Promise = require('bluebird');
const {fork} = require('child_process');
const testConfig = require('./config.json');
const DEFAULT_WORKERS = 5;

let wssProcess;

function _waitForWebSocketServer({port, serverType, messagesToSend}) {
    return new Promise((resolve, reject) => {
        wssProcess = fork('./server', [
            '--port', port,
            '--wsType', serverType,
            '--expectedMessages', messagesToSend
        ]);
        wssProcess.on('message', (msg) => {
            if (msg === 'online') {
                resolve(wssProcess);
            }
        });

        wssProcess.on('error', reject);
    });
}

function spawnWorkers({type, numOfWorkers, totalConnections, port, clientType, messagesToSend, msgSize}) {
    let workers = [];

    // balance out connections and messages across workers
    let splitConnections = Math.floor(totalConnections / numOfWorkers);
    let leftOverConnections = totalConnections - (splitConnections * numOfWorkers);

    let splitMessages = Math.floor(messagesToSend / numOfWorkers);
    let leftOverMessages = messagesToSend - (splitMessages * numOfWorkers);
    console.log(numOfWorkers);

    for (let i = 0; i < numOfWorkers; i++ ) {
        let worker = fork('./worker', [
            '--testType', type,
            '--uri', `ws://localhost:${port}`,
            '--wsType', clientType,
            '--connections', leftOverConnections ? splitConnections + 1 : splitConnections,
            '--messages', leftOverMessages ? splitMessages + 1 : splitMessages,
            '--msgSize', msgSize
        ]);
        leftOverConnections--;
        leftOverMessages--;
        workers.push(worker);
    }
    return workers;
}



let args = require('argly').createParser({
    '--port': 'number',
    '--wsType': 'string',
    '--workers': 'number',
    '--connectionsEach': 'number',
    '--messages': 'number'
}).parse();

let successfulConnections = 0;

function _setup(options) {
    options.msgSize = options.msgSize || 1000;
    options.port = options.port || 8000;
    options.numOfWorkers = options.numOfWorkers || DEFAULT_WORKERS;
    let {type, port, serverType, clientType, totalConnections, numOfWorkers, messagesToSend, msgSize} = options;
    console.log(`Test Type ${type}`);
    console.log(`Total messages to be sent: ${messagesToSend}`);
    console.log(`Total connections to establish: ${totalConnections}`);
    console.log(`Number of workers: ${numOfWorkers}`);
    console.log(`Server: ${serverType}`);
    console.log(`Client: ${clientType}`);
    console.log(`Message size: ${msgSize} bytes`);

    let workers = spawnWorkers(options);
    return _waitForWebSocketServer({port, serverType, messagesToSend})
        .then((wss) => {
            return {wss, workers};
        });
}

function _killWorkers(workers) {
    workers.forEach((worker) => {
        worker.kill();
    });
}

function test(name, options) {
    return new Promise((resolve, reject) => {
        _setup(options).then(({wss, workers}) => {
            let startTime = Date.now();
            let connectionCount = 0;
            let msgCount = 0;
            // start clients
            workers.forEach((client) => {
                client.send('start');
            });
            wss.on('message', (msg) => {
                switch (msg.type) {
                    case 'msgReceived':
                        // TODO: calculate latency
                        msgCount++;
                        //if (msgCount % 100 === 0) {
                        //    console.log(msgCount);
                        //}
                        break;
                    case 'connection':
                        connectionCount++;
                        if (connectionCount === options.totalConnections && options.type === 'connection') {
                            console.log(`${connectionCount} connections made in ${(Date.now() - startTime) / 1000} seconds`);
                            _killWorkers(workers);
                            wss.kill();
                            resolve();
                        }
                        break;
                    case 'complete':
                        console.log(`Completed in: ${(Date.now() - startTime) / 1000} sec\n`);
                        _killWorkers(workers);
                        wss.kill();
                        resolve();
                        break;
                    case 'error':
                        reject(new Error('Unable to complete test, web socket server exited with error', msg));
                }
            });
        });
    });
}

let set = ['uws', 'ws'];
let permutations = [];
for (var i = 0; i < set.length; i++) {
    for (var j = 0; j < set.length; j++) {
        permutations.push({
            serverType: set[i],
            clientType: set[j]
        });
    }
}
function runTestSuite(options) {
    let promise = Promise.resolve();
    permutations.forEach(({serverType, clientType}) => {
        promise = promise.then(() => {
            console.log('--------------------------------');
            return test(`${serverType} server with ${clientType} sockets`,
                Object.assign({serverType, clientType}, options))
                    .delay(1000)
                    .then(() => {
                        console.log('\n\n');
                    });
        });
    });
    return promise;
}

// run all tests
let promise = Promise.resolve();
testConfig.suites.forEach((testOptions) => {
    promise = promise.then(() => {
        return runTestSuite(testOptions);
    });
});

process.on('exit', () => {
    console.log("Benchmark Complete");
});
