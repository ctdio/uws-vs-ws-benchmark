# uws vs ws benchmark

A quickly tossed together tool for benchmarking [uWebsockets](https://github.com/uWebsockets/uWebsockets) vs [ws](https://github.com/websockets/ws).

### Usage
To run the benchmark, run:

```
node benchmark.js
```

### The benchmark

This benchmark tests cross tests the server and client implementations against each other (`uws` server with `uws` client, `ws` server with `uws` client, etc.). For each test, a server and multiple workers are spawned. The server simply waits for connections and upon receiving a message, will simply send it back. The workers will each try to connect multiple websockets with the server and then begin relaying messages. Messages are sent to the server upon initial connection and when a message is received from the server. There is no difference in the logic in the servers or workers aside from library that is used.

There are two phases to the benchmark. The first phase bombs the server with connections to see how long it takes to connect varying amount of websockets. The second phase of the test involves creating a set amount of connections and sending a large amount of messages to the server at the same time to see how long it takes for the server to receive the messages.

### Findings

In general, `uws` was much faster at both creating connections and relaying messages. The differences between the implementations were quite minimal when the amount of connections made and messages sent were small. However, as the numbers increased, the amount of time it took when `ws` was the acting server increased quite a bit. `ws` was especially slow when it came to creating a large amount of connections taking 3-4 times longer to complete the test when compared to `uws` (on my 2016 specced out MBP). Message relaying wasn't nearly as bad, but `uws` was still at times 1.5-2 times faster (again 2016 MBP).

Charts will be posted later, but for now try running the tests on your own.
