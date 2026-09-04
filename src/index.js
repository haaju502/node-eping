const { execFile } = require("child_process");
const { EventEmitter } = require("events");

class Eping extends EventEmitter {
    constructor(options = {}) {
        super();

        this.hosts = options.hosts || [];

        this.tryouts = Math.max(1, options.tryouts || 1);
        this.period = Math.max(1, options.period || 1);
        this.timeout = Math.max(1, options.timeout || 1000);
        this.wait = Math.max(1, options.wait || 1000);

        this.running = false;
        this.results = new Map();
    }

    set(options = {}) {
        if (this.running) {
            this.emit("error", new Error(
                "you are not allowed change options while running"
            ));
            return this;
        }

        if (Array.isArray(options.hosts)) {
            if (!options.hosts.every(h => typeof h === "string")) {
                throw new TypeError("Array must contain strings");
            }

            this.hosts = options.hosts;
        }

        if (options.timeout !== undefined) {
            this.timeout = Math.max(1, options.timeout);
        }

        if (options.wait !== undefined) {
            this.wait = Math.max(1, options.wait);
        }

        if (options.period !== undefined) {
            this.period = Math.max(1, options.period);
        }

        if (options.tryouts !== undefined) {
            this.tryouts = Math.max(1, options.tryouts);
        }

        return this;
    }

    async ping(host) {
        return new Promise((resolve) => {
            const start = Date.now();

            const child = execFile(
                "ping",
                [
                    "-c", "1",
                    "-W", String(Math.ceil(this.timeout / 1000)),
                    host
                ],
                {
                    timeout: this.timeout + 500
                },
                (error, stdout) => {

                    const responseTime = Date.now() - start;

                    if (!error) {
                        resolve({
                            host,
                            isUp: true,
                            responseTime,
                            icmpTypeId: 0,
                            icmpCodeId: 0
                        });
                    } else {
                        resolve({
                            host,
                            isUp: false,
                            responseTime,
                            icmpTypeId: null,
                            icmpCodeId: null
                        });
                    }
                }
            );

            child.on("error", () => {
                resolve({
                    host,
                    isUp: false,
                    responseTime: Date.now() - start,
                    icmpTypeId: null,
                    icmpCodeId: null
                });
            });
        });
    }

    async start() {
        if (this.running) {
            this.emit("error", new Error(
                "you are not allowed start twice"
            ));
            return this;
        }

        this.running = true;
        this.results.clear();

        try {
            for (let attempt = 0; attempt < this.tryouts; attempt++) {

                for (const host of this.hosts) {
                    if (!this.running) {
                        return this;
                    }

                    const result = await this.ping(host);

                    this.results.set(host, result);

                    this.emit(
                        "one",
                        host,
                        result.isUp,
                        {
                            icmp_type_id: result.icmpTypeId,
                            icmp_code_id: result.icmpCodeId,
                            responce_time: result.responseTime
                        }
                    );

                    if (this.period > 0) {
                        await sleep(this.period);
                    }
                }

                if (attempt + 1 < this.tryouts) {
                    await sleep(this.wait);
                }
            }


            const all = this.hosts.map(host => {
                const result = this.results.get(host);
                return result ? result.isUp : false;
            });

            this.running = false;

            this.emit("all", all);

        } catch (err) {
            this.running = false;
            this.emit("error", err);
        }

        return this;
    }

    stop() {
        this.running = false;
        return this;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


const pinger = new Eping({
    hosts: [
        "127.0.0.1",
        "192.168.1.1",
        "8.8.8.8"
    ],

    timeout: 1000,
    wait: 1000,
    period: 10,
    tryouts: 2
});

pinger.on("one", (host, isUp, details) => {
    console.log(
        `[${isUp ? "+" : "-"}] ${host} ` +
        `${details.responce_time} ms`
    );
});

pinger.on("all", (results) => {
    console.log("All results:", results);
});

pinger.on("error", (err) => {
    console.error("Error:", err.message);
});

pinger.start();

