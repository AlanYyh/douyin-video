const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const NIGHT_VIDEO_DIR = path.join(__dirname, 'public', 'night-videos');
if (!fs.existsSync(NIGHT_VIDEO_DIR)) fs.mkdirSync(NIGHT_VIDEO_DIR, { recursive: true });
app.use('/night-videos', express.static(NIGHT_VIDEO_DIR));

const DATA_FILE = path.join(__dirname, 'data.json');
const VIDEOS_FILE = path.join(__dirname, 'videos.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const DEFAULT_ADMIN_PASSWORD = 'admin123';
const API_BASE = 'https://api.5k4.cn/api/sjxjj';
const API_CATEGORIES = ['jk', 'baisi', 'chuanda', 'gaozhiliang', 'qingchun', 'rewu', 'heisi', 'nvda', 'shejie', 'all'];

function loadSettings() {
    if (!fs.existsSync(SETTINGS_FILE)) {
        const initial = { nightPassword: '18+', nightPasswordVersion: 1, adminPassword: DEFAULT_ADMIN_PASSWORD };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(initial, null, 2));
        return initial;
    }
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    if (!settings.nightPasswordVersion) settings.nightPasswordVersion = 1;
    if (!settings.adminPassword) settings.adminPassword = DEFAULT_ADMIN_PASSWORD;
    return settings;
}

function saveSettings(settings) { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2)); }

function loadVideos() {
    if (!fs.existsSync(VIDEOS_FILE)) return {};
    return JSON.parse(fs.readFileSync(VIDEOS_FILE, 'utf8'));
}

function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        const initial = { users: {}, favorites: {}, watchHistory: [], stats: { totalWatches: 0, categoryWatches: {} } };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
        return initial;
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function hashPassword(password) { return crypto.createHash('sha256').update(password).digest('hex'); }

function fetchApi(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { rejectUnauthorized: false }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    data = data.trim();
                    let parsed = JSON.parse(data);
                    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
                    resolve(parsed);
                } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    const settings = loadSettings();
    res.json(password === settings.adminPassword ? { success: true } : { success: false, message: '密码错误' });
});

app.get('/api/admin/password', (req, res) => res.json({ success: true }));

app.post('/api/admin/password', (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.json({ success: false, message: '新密码长度至少6位' });
    const settings = loadSettings();
    if (oldPassword !== settings.adminPassword) return res.json({ success: false, message: '原密码错误' });
    settings.adminPassword = newPassword;
    saveSettings(settings);
    res.json({ success: true });
});

app.get('/api/admin/stats', (req, res) => {
    const data = loadData();
    const totalUsers = Object.keys(data.users).length;
    const totalWatches = data.stats.totalWatches || 0;
    let totalFavorites = 0;
    const recentFavorites = [];
    for (const username in data.favorites) {
        const userFavs = data.favorites[username] || [];
        totalFavorites += userFavs.length;
        userFavs.forEach(f => recentFavorites.push({ username, ...f }));
    }
    recentFavorites.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const categoryStats = [];
    for (const cat in data.stats.categoryWatches) categoryStats.push({ category: cat, count: data.stats.categoryWatches[cat] });
    categoryStats.sort((a, b) => b.count - a.count);
    const userWatches = {};
    (data.watchHistory || []).forEach(w => { userWatches[w.username || '游客'] = (userWatches[w.username || '游客'] || 0) + 1; });
    const userStats = Object.entries(userWatches).map(([username, watch_count]) => ({ username, watch_count })).sort((a, b) => b.watch_count - a.watch_count);
    res.json({ success: true, totalUsers, totalWatches, totalFavorites, categoryStats, userStats: userStats.slice(0, 20), recentFavorites: recentFavorites.slice(0, 50) });
});

app.get('/api/video', async (req, res) => {
    const { category, username } = req.query;
    const cat = category || 'jk';
    try {
        const localVideos = loadVideos();
        const hasLocalVideos = localVideos[cat] && localVideos[cat].length > 0;
        const hasApiSupport = API_CATEGORIES.includes(cat);
        let videoUrl = null;
        if (hasLocalVideos && hasApiSupport) {
            if (Math.random() < 0.5) {
                videoUrl = localVideos[cat][Math.floor(Math.random() * localVideos[cat].length)];
            } else {
                const apiData = await fetchApi(`${API_BASE}?category=${cat}`);
                if (apiData.code === 200 && apiData.data?.videoUrl) videoUrl = apiData.data.videoUrl;
            }
        } else if (hasLocalVideos) {
            videoUrl = localVideos[cat][Math.floor(Math.random() * localVideos[cat].length)];
        } else if (hasApiSupport) {
            const apiData = await fetchApi(`${API_BASE}?category=${cat}`);
            if (apiData.code === 200 && apiData.data?.videoUrl) videoUrl = apiData.data.videoUrl;
        }
        if (!videoUrl && hasApiSupport) {
            const apiData = await fetchApi(`${API_BASE}?category=${cat}`);
            if (apiData.code === 200 && apiData.data?.videoUrl) videoUrl = apiData.data.videoUrl;
        }
        if (videoUrl) {
            setImmediate(() => {
                try {
                    const data = loadData();
                    data.stats.totalWatches = (data.stats.totalWatches || 0) + 1;
                    data.stats.categoryWatches = data.stats.categoryWatches || {};
                    data.stats.categoryWatches[cat] = (data.stats.categoryWatches[cat] || 0) + 1;
                    data.watchHistory = data.watchHistory || [];
                    data.watchHistory.push({ username: username || null, category: cat, video_url: videoUrl, watched_at: new Date().toISOString() });
                    if (data.watchHistory.length > 1000) data.watchHistory = data.watchHistory.slice(-1000);
                    saveData(data);
                } catch (e) {}
            });
            res.json({ success: true, videoUrl });
        } else {
            res.json({ success: false, message: '获取视频失败' });
        }
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/user/register', (req, res) => {
    const { username, password } = req.body;
    const data = loadData();
    if (data.users[username]) return res.json({ success: false, message: '用户名已存在' });
    data.users[username] = { password: hashPassword(password), created_at: new Date().toISOString() };
    data.favorites[username] = [];
    saveData(data);
    res.json({ success: true });
});

app.post('/api/user/login', (req, res) => {
    const { username, password } = req.body;
    const data = loadData();
    const user = data.users[username];
    res.json(user && user.password === hashPassword(password) ? { success: true, username } : { success: false, message: '用户名或密码错误' });
});

app.post('/api/user/favorite', (req, res) => {
    const { username, videoUrl, category, action } = req.body;
    const data = loadData();
    if (!data.favorites[username]) data.favorites[username] = [];
    if (action === 'add') {
        if (!data.favorites[username].find(f => f.video_url === videoUrl)) {
            data.favorites[username].unshift({ video_url: videoUrl, category, created_at: new Date().toISOString() });
        }
    } else {
        data.favorites[username] = data.favorites[username].filter(f => f.video_url !== videoUrl);
    }
    saveData(data);
    res.json({ success: true });
});

app.get('/api/user/favorites', (req, res) => {
    const data = loadData();
    res.json({ success: true, favorites: data.favorites[req.query.username] || [] });
});

app.get('/api/night/list', (req, res) => {
    try {
        const files = fs.readdirSync(NIGHT_VIDEO_DIR).filter(f => /\.(mp4|webm|mov)$/i.test(f));
        const videosWithInfo = files.map(f => ({ filename: f, uploadTime: fs.statSync(path.join(NIGHT_VIDEO_DIR, f)).mtime }))
            .sort((a, b) => new Date(a.uploadTime) - new Date(b.uploadTime));
        res.json({ success: true, videos: videosWithInfo, count: files.length });
    } catch (e) { res.json({ success: true, videos: [], count: 0 }); }
});

app.get('/api/night/random', (req, res) => {
    try {
        const settings = loadSettings();
        const files = fs.readdirSync(NIGHT_VIDEO_DIR).filter(f => /\.(mp4|webm|mov)$/i.test(f));
        if (files.length === 0) return res.json({ success: false, message: '暂无视频' });
        res.json({ success: true, videoUrl: `/night-videos/${files[Math.floor(Math.random() * files.length)]}`, count: files.length, passwordVersion: settings.nightPasswordVersion });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/night/upload', (req, res) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) return res.json({ success: false, message: '请使用表单上传' });
    let data = [];
    req.on('data', chunk => data.push(chunk));
    req.on('end', () => {
        try {
            const buffer = Buffer.concat(data);
            const boundary = contentType.split('boundary=')[1];
            const parts = buffer.toString('binary').split('--' + boundary);
            for (const part of parts) {
                if (part.includes('filename=')) {
                    const filenameMatch = part.match(/filename="([^"]+)"/);
                    if (filenameMatch) {
                        const ext = path.extname(filenameMatch[1]);
                        const filename = Date.now() + '_' + Math.random().toString(36).substr(2, 6) + ext;
                        const headerEnd = part.indexOf('\r\n\r\n') + 4;
                        const bodyEnd = part.lastIndexOf('\r\n');
                        fs.writeFileSync(path.join(NIGHT_VIDEO_DIR, filename), part.substring(headerEnd, bodyEnd), 'binary');
                        return res.json({ success: true, filename });
                    }
                }
            }
            res.json({ success: false, message: '未找到文件' });
        } catch (e) { res.json({ success: false, message: e.message }); }
    });
});

app.post('/api/night/delete', (req, res) => {
    const filePath = path.join(NIGHT_VIDEO_DIR, req.body.filename);
    try {
        if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); res.json({ success: true }); }
        else res.json({ success: false, message: '文件不存在' });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/night/verify', (req, res) => {
    const settings = loadSettings();
    res.json(req.body.password === settings.nightPassword ? { success: true, passwordVersion: settings.nightPasswordVersion } : { success: false, message: '密码错误' });
});

app.get('/api/admin/night-password', (req, res) => res.json({ success: true, password: loadSettings().nightPassword }));

app.post('/api/admin/night-password', (req, res) => {
    const { password } = req.body;
    if (!password) return res.json({ success: false, message: '密码不能为空' });
    const settings = loadSettings();
    settings.nightPassword = password;
    settings.nightPasswordVersion = (settings.nightPasswordVersion || 1) + 1;
    saveSettings(settings);
    res.json({ success: true });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.listen(80, '0.0.0.0', () => console.log('Server running on port 80'));
