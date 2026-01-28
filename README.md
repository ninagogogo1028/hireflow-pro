<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# HireFlow Pro - Recruitment SOP & Talent Pool OS

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![React](https://img.shields.io/badge/React-18-blue)
![Vite](https://img.shields.io/badge/Vite-5-646CFF)
![Gemini AI](https://img.shields.io/badge/Powered%20by-Gemini%20AI-8E75B2)

**HireFlow Pro** 是一款现代化的招聘管理系统，旨在优化招聘流程（SOP）并建立高潜力人才储备库。通过集成 Google Gemini AI，它能够自动化职位描述分析、智能匹配人才以及解析简历关键信息。

</div>

## ✨ 核心特性

- **🚀 招聘流程 SOP 看板**: 可视化管理候选人从初筛到入职的全流程。
- **🧠 AI 智能人才对标**: 基于 Gemini 大模型，自动分析 JD 与人才库的匹配度。
- **📂 人才储备池**: 独立管理高潜力人才，支持跨职位激活与长期跟踪。
- **📊 招聘数据仪表盘**: 实时监控招聘进度、转化率与漏斗分析。
- **📝 职位需求管理**: 灵活管理正式 HC 与实习生需求。

## 🛠️ 技术栈

- **前端框架**: React + TypeScript
- **构建工具**: Vite
- **UI 样式**: Tailwind CSS + Lucide React Icons
- **AI 模型**: Google Gemini Pro (via `@google/genai` SDK)

## 🚀 快速开始

### 前置要求

- Node.js (v18+)
- Google Gemini API Key ([获取密钥](https://makersuite.google.com/app/apikey))

### 安装与运行

1. **克隆项目**
   ```bash
   git clone https://github.com/YOUR_USERNAME/hireflow-pro.git
   cd hireflow-pro
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   在项目根目录创建 `.env.local` 文件，并填入你的 Gemini API 密钥：
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   ```
   访问 `http://localhost:3000` 即可开始使用。

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📄 开源协议

本项目采用 [MIT 协议](LICENSE)。
