# Market Scout (美股 & 加密货币 机会监控哨兵)

这是一个自动化的市场机会监控报警系统，旨在帮助用户盯盘，寻找美股（如 NVDA）和加密货币（如 BTC-USD）的技术指标买入信号。

## 🎯 核心功能

### 1. 自动化监控
程序会自动扫描你关注的标的，支持以下技术指标信号：
- **均线突破**:
  - **MA10 突破**: 价格站上 10 日均线。
  - **MA14 突破**: 价格站上 14 日均线。
- **趋势指标**:
  - **MACD 低位金叉**: MACD 在 0 轴下方形成金叉（快线上穿慢线）。
  - **KDJ 低位金叉**: KDJ 在低位（<30）形成金叉。

### 2. 可视化仪表盘
- **Web 界面**: 支持添加/删除关注的股票或币种，并可为每个标的单独配置指标开关。
- **倒计时**: 显示距离下一次自动检查的时间（通常为工作日 UTC 21:00）。
- **手动控制**: 提供“测试通知”和“立即检查”按钮，方便随时验证。

### 3. 数据源诊断
项目包含一个 `test-yahoo.ts` 脚本，用于检测网络连通性和数据源状态：
- 测试 **Yahoo Finance** 搜索与报价。
- 测试 **Binance** (及 Binance Vision/US) 接口。
- 测试 **CoinGecko** 接口。

如果遇到数据获取失败，可以直接运行此脚本进行排查：
```bash
npx ts-node test-yahoo.ts
```

---

## 🚀 快速开始 (Getting Started)

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
