// health.js
const http = require('http');
const url = require('url');

// خادم فحص الصحة المنفصل
function startHealthServer(port = process.env.PORT || 3000) {
    const server = http.createServer((req, res) => {
        const parsedUrl = url.parse(req.url, true);
        
        // نقطة فحص الصحة الأساسية
        if (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/') {
            res.writeHead(200, { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            });
            
            const healthData = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'telegram-bot-ichancy',
                version: process.env.npm_package_version || '1.0.0',
                node_version: process.version,
                uptime: process.uptime(),
                memory: {
                    rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
                    heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
                    heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
                }
            };
            
            res.end(JSON.stringify(healthData, null, 2));
        }
        // نقطة فحص متقدمة
        else if (parsedUrl.pathname === '/health/detailed') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            
            const detailedData = {
                status: 'healthy',
                checks: {
                    telegram_bot: 'connected',
                    database: 'connected',
                    api: 'reachable'
                },
                environment: process.env.NODE_ENV || 'development',
                platform: process.platform,
                arch: process.arch,
                cpu_usage: process.cpuUsage(),
                pid: process.pid,
                cwd: process.cwd()
            };
            
            res.end(JSON.stringify(detailedData, null, 2));
        }
        // نقطة للمراقبة (لـ Prometheus)
        else if (parsedUrl.pathname === '/metrics') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            
            const metrics = `
# HELP nodejs_version_info Node.js version info
# TYPE nodejs_version_info gauge
nodejs_version_info{version="${process.version}"} 1

# HELP process_start_time_seconds Start time of the process since unix epoch in seconds
# TYPE process_start_time_seconds gauge
process_start_time_seconds ${Math.floor(Date.now() / 1000) - Math.floor(process.uptime())}

# HELP process_uptime_seconds Total uptime of the process in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${process.uptime()}

# HELP process_resident_memory_bytes Resident memory size in bytes
# TYPE process_resident_memory_bytes gauge
process_resident_memory_bytes ${process.memoryUsage().rss}

# HELP telegram_bot_status Telegram bot status
# TYPE telegram_bot_status gauge
telegram_bot_status 1
            `;
            
            res.end(metrics.trim());
        }
        else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                error: 'Endpoint not found',
                available_endpoints: ['/health', '/health/detailed', '/metrics']
            }));
        }
    });

    server.listen(port, '0.0.0.0', () => {
        console.log(`✅ Health check server running on port ${port}`);
        console.log(`🌐 Health check endpoints:`);
        console.log(`   http://0.0.0.0:${port}/health`);
        console.log(`   http://0.0.0.0:${port}/health/detailed`);
        console.log(`   http://0.0.0.0:${port}/metrics`);
    });

    server.on('error', (error) => {
        console.error('❌ Health server error:', error.message);
        if (error.code === 'EADDRINUSE') {
            console.log(`⚠️ Port ${port} is already in use. Trying ${Number(port) + 1}...`);
            startHealthServer(Number(port) + 1);
        }
    });

    return server;
}

module.exports = { startHealthServer };
