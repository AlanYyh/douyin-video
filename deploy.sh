#!/bin/bash
set -e

echo "=========================================="
echo "      抖音风格短视频系统 - 一键部署"
echo "=========================================="

if [ "$EUID" -ne 0 ]; then
    echo "请使用 root 用户运行此脚本"
    exit 1
fi

echo "[1/5] 更新系统并安装依赖..."
apt update -qq
apt install -y curl

echo "[2/5] 安装 Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "Node.js 版本: $(node -v)"

echo "[3/5] 安装项目依赖..."
cd /root/douyin-video
npm install --production

echo "[4/5] 修复文件编码..."
find . -name "*.js" -o -name "*.json" -o -name "*.html" | xargs -I {} sed -i 's/\r$//' {}
sed -i '1s/^\xEF\xBB\xBF//' videos.json 2>/dev/null || true

echo "[5/5] 配置系统服务..."
cat > /etc/systemd/system/douyin.service << 'EOF'
[Unit]
Description=Douyin Video Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/douyin-video
ExecStart=/usr/bin/node /root/douyin-video/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable douyin
systemctl restart douyin

sleep 2

if systemctl is-active --quiet douyin; then
    echo ""
    echo "=========================================="
    echo "            部署成功！"
    echo "=========================================="
    echo ""
    echo "  视频页面: http://$(hostname -I | awk '{print $1}')"
    echo "  后台管理: http://$(hostname -I | awk '{print $1}')/admin"
    echo "  默认后台密码: admin123"
    echo "  (建议首次登录后修改密码)"
    echo ""
    echo "  服务管理命令:"
    echo "    启动: systemctl start douyin"
    echo "    停止: systemctl stop douyin"
    echo "    重启: systemctl restart douyin"
    echo "    状态: systemctl status douyin"
    echo "    日志: journalctl -u douyin -f"
    echo ""
else
    echo "服务启动失败，请检查日志: journalctl -u douyin -n 50"
    exit 1
fi
