# 抖音风格短视频系统

仿抖音的移动端短视频播放系统，支持上下滑动切换视频、多分类筛选、用户注册登录、视频收藏等功能。

## 功能特性

### 前台功能
- 📱 **仿抖音交互** - 上滑下一个，下滑返回上一个
- 🎬 **多分类视频** - JK制服、白丝、黑丝、穿搭、热舞等10+分类
- 🔞 **深夜模式** - 18+年龄验证 + 密码保护
- 👤 **用户系统** - 注册、登录、收藏视频
- 🔊 **播放控制** - 静音、全屏、进度条
- 📵 **智能缓存** - 最多保留2个视频，自动清理内存

### 后台功能
- 📊 **数据统计** - 用户数、观看次数、收藏数
- 📈 **分类统计** - 各分类观看排行
- 👥 **用户排行** - 活跃用户排行榜
- 🎥 **视频管理** - 上传/删除深夜视频
- 🔑 **密码设置** - 实时修改深夜分类密码
- ⚙️ **系统设置** - 修改后台管理密码

### 技术特性
- 🔄 **混合视频源** - 本地视频 + 远程API 各50%概率
- 🚫 **禁止预加载** - 节省流量，按需加载
- 🔒 **密码版本控制** - 修改密码后立即失效

## 项目结构

```
douyin-video/
├── server.js          # 服务端主程序
├── package.json       # 项目依赖
├── videos.json        # 本地视频URL库 (900个)
├── deploy.sh          # 一键部署脚本
├── public/
│   ├── index.html     # 前台视频播放页
│   ├── admin.html     # 后台管理页
│   └── night-videos/  # 深夜视频存储目录
├── data.json          # 用户数据 (自动生成)
└── settings.json      # 系统设置 (自动生成)
```

## 快速部署

### 环境要求
- Ubuntu 20.04+ / Debian 11+
- Node.js 18+
- 开放 80 端口

### 部署步骤

1. **上传项目到服务器**

> ⚠️ **重要提示：建议使用 SCP 命令行工具上传文件，避免使用 FTP 客户端导致的 UTF-8 BOM 编码问题**

```bash
scp -r douyin-video root@你的服务器IP:/root/
```

2. **SSH连接服务器执行部署**
```bash
cd /root/douyin-video
chmod +x deploy.sh
./deploy.sh
```

3. **访问网站**
- 视频页面: `http://你的服务器IP`
- 后台管理: `http://你的服务器IP/admin`
- 默认后台密码: `admin123`（建议首次登录后修改）

## 服务管理

```bash
# 启动服务
systemctl start douyin

# 停止服务
systemctl stop douyin

# 重启服务
systemctl restart douyin

# 查看状态
systemctl status douyin

# 实时日志
journalctl -u douyin -f
```

## 视频分类

| 分类 | 说明 | 来源 |
|------|------|------|
| 全部 | 随机所有类型 | API |
| JK制服 | 学院风 | 本地+API |
| 白丝 | 白色丝袜 | 本地+API |
| 黑丝 | 黑色丝袜 | 本地+API |
| 穿搭 | 时尚穿搭 | 本地+API |
| 高质量 | 精选内容 | 本地+API |
| 清纯 | 清纯风格 | 本地+API |
| 热舞 | 舞蹈视频 | 本地+API |
| 女大 | 大学生 | 本地+API |
| 御姐 | 成熟风格 | 本地+API |
| 深夜 | 18+内容 | 本地上传 |

## 配置说明

### 后台管理密码
- 默认密码: `admin123`
- 在后台管理 → 系统设置 → 修改密码
- 修改后需重新登录

### 深夜分类密码
- 默认密码: `18+`
- 在后台管理 → 深夜视频管理 → 修改密码
- 修改后立即生效，已登录用户需重新验证

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/video | GET | 获取随机视频 |
| /api/user/register | POST | 用户注册 |
| /api/user/login | POST | 用户登录 |
| /api/user/favorite | POST | 收藏/取消收藏 |
| /api/user/favorites | GET | 获取收藏列表 |
| /api/night/random | GET | 获取深夜视频 |
| /api/night/verify | POST | 验证深夜密码 |
| /api/admin/login | POST | 后台登录 |
| /api/admin/stats | GET | 获取统计数据 |
| /api/admin/password | POST | 修改后台密码 |

## 常见问题

### 视频加载失败
1. 检查 `videos.json` 文件编码是否正确 (UTF-8 无 BOM)
2. 运行修复命令:
```bash
sed -i '1s/^\xEF\xBB\xBF//' videos.json
sed -i 's/\r$//' videos.json
systemctl restart douyin
```

### 上传文件编码问题
使用 FTP 客户端（如 FileZilla）上传可能导致文件编码变为 UTF-8 BOM，建议：
- 使用 `scp` 命令行工具上传
- 或上传后执行部署脚本自动修复编码

### 服务无法启动
```bash
# 查看错误日志
journalctl -u douyin -n 50

# 常见原因: 端口被占用
lsof -i:80
```

## 开源协议

MIT License
