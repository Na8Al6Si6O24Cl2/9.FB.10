const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    
    if (userAgent.includes('Roblox')) {
        return next();
    }
    
    return res.status(403).end();
});

const pendingScripts = new Map();

app.post('/api/execute', (req, res) => {
    const { userId, script, timestamp } = req.body;
    
    if (!userId || !script) {
        return res.status(400).json({ error: 'userId와 script가 필요합니다' });
    }
    
    if (!pendingScripts.has(userId)) {
        pendingScripts.set(userId, []);
    }
    
    pendingScripts.get(userId).push({
        script: script,
        timestamp: timestamp || new Date().toISOString(),
        id: Date.now()
    });
    
    console.log(`[${userId}] 스크립트 수신 (길이: ${script.length})`);
    
    res.json({ 
        success: true, 
        message: '스크립트가 큐에 추가되었습니다',
        queueSize: pendingScripts.get(userId).length
    });
});

app.get('/api/get-scripts/:userId', (req, res) => {
    const { userId } = req.params;
    
    if (!pendingScripts.has(userId) || pendingScripts.get(userId).length === 0) {
        return res.json({ scripts: [] });
    }
    
    const scripts = pendingScripts.get(userId);
    pendingScripts.set(userId, []); // 큐 비우기
    
    console.log(`[${userId}] ${scripts.length}개 스크립트 전송`);
    
    res.json({ 
        scripts: scripts.map(s => s.script),
        count: scripts.length
    });
});

app.get('/api/status', (req, res) => {
    const stats = {};
    pendingScripts.forEach((scripts, userId) => {
        stats[userId] = scripts.length;
    });
    
    res.json({
        status: 'running',
        timestamp: new Date().toISOString(),
        pendingScripts: stats
    });
});

app.delete('/api/clear/:userId', (req, res) => {
    const { userId } = req.params;
    
    if (pendingScripts.has(userId)) {
        const count = pendingScripts.get(userId).length;
        pendingScripts.set(userId, []);
        res.json({ success: true, cleared: count });
    } else {
        res.json({ success: true, cleared: 0 });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`✅ 백엔드 서버 실행 중: http://localhost:${PORT}`);
    console.log(`📡 WPF 엔드포인트: POST /api/execute`);
    console.log(`🎮 로블록스 엔드포인트: GET /api/get-scripts/:userId`);
});

setInterval(() => {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000;
    
    pendingScripts.forEach((scripts, userId) => {
        const filtered = scripts.filter(s => {
            const age = now - new Date(s.timestamp).getTime();
            return age < maxAge;
        });
        
        if (filtered.length !== scripts.length) {
            console.log(`[${userId}] ${scripts.length - filtered.length}개 오래된 스크립트 제거`);
            pendingScripts.set(userId, filtered);
        }
    });

}, 10 * 60 * 1000);
