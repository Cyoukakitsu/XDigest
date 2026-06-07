#!/bin/bash
# XDigest 环境验证脚本
# 每次开始新会话前运行，确认项目可以正常工作

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== XDigest 初始化检查 ==="

# 后端测试
echo ""
echo "▶ 运行后端测试..."
cd backend
./venv/bin/python -m pytest --tb=short -q
cd ..

# 前端 lint（可选，失败不阻断）
echo ""
echo "▶ 运行前端 lint..."
cd frontend && npm run lint --silent 2>&1 || echo "  ⚠ lint 有警告，但不阻断"
cd ..

echo ""
echo "=== 检查完成 ==="
echo ""
echo "当前状态："
echo "  • 功能列表：feature_list.json"
echo "  • 进度记录：progress.md"
echo "  • 上次交接：session-handoff.md"
